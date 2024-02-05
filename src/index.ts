#!/usr/bin/env node

/*
 * Copyright (c) The ANTLR Project. All rights reserved.
 * Use of this file is governed by the BSD 3-clause license that
 * can be found in the LICENSE.txt file in the project root.
 */

// @ts-ignore, because when setting node module resolution to Node16, tsc raises an error for the import assertion.
import configSchema from "./config-schema.json" assert { type: "json" };

import { spawnSync } from "child_process";
import { OptionValues, program } from "commander";
import Ajv, { ErrorObject } from "ajv";
import betterAjvErrors from "@readme/better-ajv-errors";
import { existsSync, readFileSync } from "fs";
import chalk from "chalk";

import { IConfiguration } from "./types.js";
import { Generator } from "./Generator.js";
import { globSync } from "glob";
import { dirname, join } from "path";
import { FileUtils } from "./FileUtils.js";

interface IAppParameters extends OptionValues {
    /**
     * Path to a JSON file containing the paths and other information for the generation process.
     */
    config?: string;

    /** Suppress all output except errors. */
    silent?: boolean;

    /** Print additional information. */
    verbose?: boolean;
}

/**
 * Processes the options specified by the user validates them.
 *
 * @param configPath The path to the configuration file.
 *
 * @returns The configuration object.
 */
const processConfiguration = (configPath?: string): IConfiguration => {
    if (configPath && existsSync(configPath)) {
        const content = readFileSync(configPath, { encoding: "utf-8" });
        const config = JSON.parse(content) as IConfiguration;

        // Validate the configuration file using our schema.
        const ajv = new Ajv.default({ allErrors: true, verbose: true });
        const validate = ajv.compile(configSchema);
        const valid = validate(config);
        if (!valid) {
            console.log(`\nFound config validation errors in ${configPath}\n`);

            // @ts-expect-error, because the type definition export is wrong.
            const error = betterAjvErrors(configSchema, config, validate.errors as ErrorObject[], {
                json: content,
            });
            console.log(error + "\n");

            process.exit(1);
        }

        return config;
    }

    console.error(`\nConfig file ${configPath} not found.\n`);
    process.exit(1);
};

// Start by testing if Java is installed.
const output = spawnSync("java", ["-version"], { stdio: "ignore" });
if (output.error) {
    console.error("Java is not installed. Please install Java 8 or later.");
    process.exit(1);
}

const start = performance.now();

program
    .option("-c, --config <path>", "Path to a JSON file containing the formatting options to use.")
    .option("-s, --silent", "Suppress all output except errors.")
    .option("-v, --verbose", "Print additional information.")
    .version("antlr-tgen 1.0.0")
    .parse();

const options = program.opts<IAppParameters>();

if (!options.silent) {
    console.log(chalk.bold("\nantlr-tgen, the ANTLRng test generator\n"));
    console.log("Processing options...");
}

const configPath = dirname(options.config!);
const details = processConfiguration(options.config);
const generator = new Generator(configPath, details, options.silent ?? false, options.verbose ?? false);
generator.generate();
console.log();

if (!options.silent) {
    console.log(chalk.blue(`Copying files...`));
}

if (details.files && details.files.length > 0) {
    for (const entry of details.files) {
        const sourceFiles = globSync(join(configPath, entry.sourcePattern));
        for (const sourceFile of sourceFiles) {
            if (options.verbose) {
                console.log(`\t${sourceFile} -> ${entry.targetPath}`);
            }

            FileUtils.copyFileOrFolder(sourceFile, join(configPath,
                entry.targetPath ?? details.targetPath ?? "./tests"));
        }
    }
}

if (!options.silent) {
    console.log(`\nDone in ${Math.round((performance.now() - start) / 1000)}s\n`);
}
