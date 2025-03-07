#!/usr/bin/env node

/*
 * Copyright (c) The ANTLR Project. All rights reserved.
 * Use of this file is governed by the BSD 3-clause license that
 * can be found in the LICENSE.txt file in the project root.
 */

import betterAjvErrors from "@readme/better-ajv-errors";
import { Ajv } from "ajv";
import chalk from "chalk";
import { OptionValues, program } from "commander";
import { existsSync, readFileSync } from "fs";

import { globSync } from "glob";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { FileUtils } from "./FileUtils.js";
import { Generator } from "./Generator.js";
import { IConfiguration } from "./types.js";

const sourcePath = fileURLToPath(dirname(import.meta.url));
const schemaPath = join(sourcePath, "./config-schema.json");
const configSchema = JSON.parse(readFileSync(schemaPath, { encoding: "utf-8" })) as Record<string, unknown>;

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
        const ajv = new Ajv({ allErrors: true, verbose: true });
        const validate = ajv.compile(configSchema);
        const valid = validate(config);
        if (!valid) {
            console.log(`\nFound config validation errors in ${configPath}\n`);

            const error = betterAjvErrors.default(configSchema, config, validate.errors ?? [], {
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

const start = performance.now();

program
    .option("-c, --config <path>", "Path to a JSON file containing the formatting options to use.")
    .option("-s, --silent", "Suppress all output except errors.")
    .option("-v, --verbose", "Print additional information.")
    .version("antlr-tgen 1.0.0")
    .parse();

const options = program.opts<IAppParameters>();

if (!options.silent) {
    console.log(chalk.bold("\nantlr-tgen, the antlr-ng test generator\n"));
    console.log("Processing options...");
}

// We have to derive the work dir directly from the current file path, which differs between running here and
// running as a package. The strategy is to find the closest package.json file and use that as the base.
let basePath = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(basePath, "package.json")) && basePath !== "/") {
    basePath = dirname(basePath);
}

const configPath = join(process.cwd(), dirname(options.config!));
const details = processConfiguration(options.config);

const generator = new Generator(basePath, configPath, details, options.silent ?? false, options.verbose ?? false);
const succeeded = generator.generate();
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

if (succeeded) {
    process.exit(0);
}

process.exit(1);
