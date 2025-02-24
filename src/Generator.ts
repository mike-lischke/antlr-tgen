/*
 * Copyright (c) Mike Lischke. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 */

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { ST, STGroup, STGroupFile, StringRenderer } from "stringtemplate4ts";
import chalk from "chalk";
import { spawnSync } from "child_process";

import { GrammarType, IConfiguration, IGenerationOptions, IRuntimeTestDescriptor } from "./types.js";
import { CustomDescriptors } from "./CustomDescriptors.js";
import { RuntimeTestDescriptorParser } from "./RuntimeTestDescriptorParser.js";
import { FileUtils } from "./FileUtils.js";

/**
 * This file generates the test cases for the runtime testsuite. It uses the test descriptors files
 * and generates all files needed to run the tests, including the test spec file.
 */

export class Generator {

    private readonly testDescriptors = new Map<string, IRuntimeTestDescriptor[]>();
    private readonly stringRenderer = new StringRenderer();
    private testCount = 0;

    public constructor(private basePath: string, private configPath: string, private config: IConfiguration,
        private silent: boolean, private verbose: boolean) {
    }

    public generate(): void {
        this.readDescriptorsFromDisk();
        this.addCustomDescriptors();

        if (!this.silent) {
            console.log(`Found ${this.testCount} tests.\n`);
        }

        // Interestingly, it does not speed up the generation when using promises here.
        this.writeTestFiles();
    }

    private readDescriptorsFromDisk(): void {
        const descriptorsPath = join(this.basePath, "resources/descriptors");

        readdirSync(descriptorsPath).forEach((entry) => {
            const stat = statSync(join(descriptorsPath, entry));
            if (stat.isDirectory()) {
                const groupName = entry;
                if (!groupName.startsWith(".")) { // Ignore hidden entries.
                    const descriptors: IRuntimeTestDescriptor[] = [];

                    const groupDir = join(descriptorsPath, groupName);
                    readdirSync(groupDir).forEach((descriptorFile) => {
                        if (!descriptorFile.startsWith(".")) {
                            const name = descriptorFile.replace(".txt", "");
                            const content = readFileSync(join(groupDir, descriptorFile), { encoding: "utf-8" });
                            descriptors.push(RuntimeTestDescriptorParser.parse(name, content, descriptorFile));

                            ++this.testCount;
                        }
                    });

                    this.testDescriptors.set(groupName, descriptors);
                }
            }
        });

        if (!this.silent) {
            console.log("Test descriptors loaded.");
        }
    }

    private addCustomDescriptors(): void {
        for (const [key, descriptors] of CustomDescriptors.descriptors) {
            this.testCount += descriptors.length;
            if (!this.testDescriptors.has(key)) {
                this.testDescriptors.set(key, descriptors);
            } else {
                this.testDescriptors.get(key)?.push(...descriptors);
            }
        }

        if (!this.silent) {
            console.log("Custom test descriptors loaded.");
        }
    }

    private writeTestFiles(): void {
        let currentTest = 0;
        for (const [caption, descriptors] of this.testDescriptors) {
            const groupPath = join(this.configPath, this.config.targetPath ?? "tests", caption);

            for (const descriptor of descriptors) {
                if (!this.isTestIncluded(caption, descriptor.name)) {
                    continue;
                }

                ++currentTest;

                if (!this.silent) {
                    const message = `Processing (${Math.round(10000 * currentTest / this.testCount) / 100}%): ` +
                        `${caption} > ${descriptor.name}`;
                    process.stdout.write(chalk.green(`\r${message.padEnd(100)}`));
                }

                const testPath = join(groupPath, descriptor.name);
                mkdirSync(testPath, { recursive: true });

                const targetTemplates = new STGroupFile(join(this.configPath, this.config.grammarTemplateFile), "utf-8",
                    "<", ">");
                targetTemplates.registerRenderer(String, this.stringRenderer);

                // Write out any slave grammars.
                const slaveGrammars = descriptor.slaveGrammars;
                if (slaveGrammars) {
                    for (const pair of slaveGrammars) {
                        const group = new STGroup("<", ">");
                        group.registerRenderer(String, this.stringRenderer);
                        group.importTemplates(targetTemplates);
                        const grammarST = new ST(group, pair[1]);
                        writeFileSync(join(testPath, pair[0] + ".g4"), grammarST.render(), { encoding: "utf-8" });
                    }
                }

                const group = new STGroup("<", ">");
                group.importTemplates(targetTemplates);
                group.registerRenderer(String, this.stringRenderer);

                const grammarST = new ST(group, descriptor.grammar);
                const grammar = grammarST.render();

                let lexerName: string | undefined;
                let parserName: string | undefined;
                let useListenerOrVisitor: boolean;
                if (descriptor.testType === GrammarType.Parser || descriptor.testType === GrammarType.CompositeParser) {
                    lexerName = descriptor.grammarName + "Lexer";
                    parserName = descriptor.grammarName + "Parser";
                    useListenerOrVisitor = true;
                } else {
                    lexerName = descriptor.grammarName;
                    useListenerOrVisitor = false;
                }

                let grammarName;

                const isCombinedGrammar = lexerName && parserName;
                if (isCombinedGrammar) {
                    if (parserName) {
                        grammarName = parserName.endsWith("Parser")
                            ? parserName.substring(0, parserName.length - "Parser".length)
                            : parserName;
                    } else {
                        if (lexerName) {
                            grammarName = lexerName.endsWith("Lexer")
                                ? lexerName.substring(0, lexerName.length - "Lexer".length)
                                : lexerName;
                        }
                    }
                } else {
                    if (parserName !== null) {
                        grammarName = parserName;
                    } else {
                        grammarName = lexerName;
                    }
                }

                const runOptions: IGenerationOptions = {
                    grammarStr: grammar,
                    grammarName,
                    parserName,
                    lexerName,
                    useListener: useListenerOrVisitor,
                    useVisitor: useListenerOrVisitor,
                };

                this.generateParserFiles(testPath, runOptions, descriptor);
            };
        }
    }

    /**
     * Run ANTLR on stuff in workdir and error queue back
     *
     * @param workdir The working directory for the ANTLR process.
     * @param targetName The target language to generate.
     * @param grammarFileName The name of the grammar file.
     * @param options Additional options for the ANTLR process.
     * @returns True if the process was successful, false otherwise.
     */
    private generateANTLRFilesInWorkDir(workdir: string, targetName: string, grammarFileName: string,
        options: string[]): boolean {
        options.push("-Dlanguage=" + targetName);

        if (!options.includes("-o")) {
            options.push("-o");
            options.push(workdir);
        }

        if (!options.includes("--lib")) {
            options.push("--lib");
            options.push(workdir);
        }
        if (!options.includes("--encoding")) {
            options.push("--encoding");
            options.push("UTF-8");
        }
        options.push(join(workdir, grammarFileName));

        // Generate test parsers, lexers and listeners.
        const output = spawnSync("antlr-ng", ["--exact-output-dir", ...options], {
            encoding: "utf-8",
            cwd: workdir,
            stdio: ["ignore", "pipe", "pipe"],
        });

        // Consider stderr output as warnings if the process exited successfully.
        const errorMessage = output.error?.message;
        if (errorMessage && errorMessage.length > 0) {
            const lines = errorMessage.split("\n");

            // Remove debugger attached and waiting for debugger messages.
            const filteredLines = lines.filter((line) => {
                if (line.length === 0) {
                    return false;
                }

                return !line.startsWith("Debugger attached.")
                    && !line.startsWith("Waiting for the debugger to disconnect...");
            });

            if (filteredLines.length > 0) {
                if (output.status === 0 && this.verbose) {
                    console.log(); // Add line break;
                }

                filteredLines.forEach((line) => {
                    if (output.status === 0) {
                        if (this.verbose) {
                            console.log(chalk.yellow("\t" + line));
                        }
                    } else {
                        console.log(chalk.red(line));
                    }
                });
            }
        }

        return output.status === 0 && !errorMessage;
    }

    private consolidate(text: string): string {
        text = text.replace(/\\/g, "\\\\");
        text = text.replace(/\n/g, "\\n");
        text = text.replace(/\r/g, "\\r");
        text = text.replace(/"/g, "\\\"");

        return text;
    };

    /**
     * Generates a test file for the given options.
     *
     * @param targetPath The path to the test file.
     * @param runOptions Details for the generation.
     * @param descriptor The descriptor for the test.
     */
    private writeTestFile(targetPath: string, runOptions: IGenerationOptions,
        descriptor: IRuntimeTestDescriptor): void {
        const text = readFileSync(join(this.configPath, this.config.specTemplateFile), { encoding: "utf-8" });
        const outputFileST = new ST(text);
        outputFileST.add("grammarName", runOptions.grammarName);
        outputFileST.add("lexerName", runOptions.lexerName);
        outputFileST.add("parserName", runOptions.parserName);
        outputFileST.add("parserStartRuleName", descriptor.startRule ?? "");
        outputFileST.add("showDiagnosticErrors", descriptor.showDiagnosticErrors);
        outputFileST.add("traceATN", descriptor.traceATN);
        outputFileST.add("profile", false);
        outputFileST.add("showDFA", descriptor.showDFA);
        outputFileST.add("useListener", runOptions.useListener);
        outputFileST.add("useVisitor", runOptions.useVisitor);
        outputFileST.add("predictionMode", descriptor.predictionMode);
        outputFileST.add("buildParseTree", descriptor.buildParseTree);
        outputFileST.add("input", this.consolidate(descriptor.input));
        outputFileST.add("expectedOutput", this.consolidate(descriptor.output));
        outputFileST.add("expectedErrors", this.consolidate(descriptor.errors));
        outputFileST.add("testName", descriptor.name);

        const annotation = descriptor.skipTargets?.has(this.config.language) ? 1 : 0;
        let command = "";
        if (this.config.testAnnotations && this.config.testAnnotations?.length > 0) {
            command = this.config.testAnnotations[annotation] ?? "";
        }
        outputFileST.add("testAnnotation", command);

        const fileName = this.config.testFileName ?? "Test";
        writeFileSync(join(targetPath, `${fileName}.${this.config.targetExtension}`), outputFileST.render());
    };

    /**
     * Generates the parser/lexer/visitor/listener files for a grammar.
     *
     * @param targetPath The folder for this particular test.
     * @param runOptions Details for the generation.
     * @param descriptor The descriptor for the test.
     */
    private generateParserFiles(targetPath: string, runOptions: IGenerationOptions,
        descriptor: IRuntimeTestDescriptor): void {
        const options: string[] = [];
        if (runOptions.useVisitor) {
            options.push("-v");
        }

        /*if (runOptions.superClass) {
            options.push("-DsuperClass=" + runOptions.superClass);
        }*/

        FileUtils.mkdir(targetPath);

        const grammarFileName = descriptor.grammarName + ".g4";
        FileUtils.writeFile(targetPath, grammarFileName, runOptions.grammarStr);

        const success = this.generateANTLRFilesInWorkDir(targetPath, this.config.language, grammarFileName, options);

        if (!success) {
            return;
        }

        this.writeTestFile(targetPath, runOptions, descriptor);
        writeFileSync(join(targetPath, "input"), descriptor.input);
    };

    private matchesPattern(name: string, patterns: string[]): boolean {
        for (const pattern of patterns) {
            if (name.match(pattern)) {
                return true;
            }
        }

        return false;
    }

    private isTestIncluded(group: string, test: string): boolean {
        const { groupIncludes = [], groupExcludes = [], testIncludes = [], testExcludes = [] } = this.config;

        if (groupExcludes.length > 0 && this.matchesPattern(group, groupExcludes)) {
            return false;
        }

        if (groupIncludes.length > 0 && !this.matchesPattern(group, groupIncludes)) {
            return false;
        }

        if (testExcludes.length > 0 && this.matchesPattern(test, testExcludes)) {
            return false;
        }

        if (testIncludes.length > 0 && !this.matchesPattern(test, testIncludes)) {
            return false;
        }

        return true;
    }
}
