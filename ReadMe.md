[![GitHub Workflow Status (with event)](https://img.shields.io/github/actions/workflow/status/mike-lischke/antlr-tgen/nodejs.yml?style=for-the-badge&logo=github)](https://github.com/mike-lischke/stringtemplate4ts/actions/workflows/nodejs.yml)[![Weekly Downloads](https://img.shields.io/npm/dw/@mike-lischke/antlr-tgen?style=for-the-badge&color=blue)](https://www.npmjs.com/package/antlr-tgen)
[![npm version](https://img.shields.io/npm/v/@mike-lischke/antlr-tgen?style=for-the-badge&color=yellow)](https://www.npmjs.com/package/antlr4ng)

<p align="center">
<img src="https://raw.githubusercontent.com/mike-lischke/mike-lischke/master/images/antlr-ng.svg" title="ANTLR Next Generation" alt="antlr-ng the parser generator" height="200"/><br/>
<label style="font-size: 120%">Part of the Next Generation ANTLR Project</label>
</p>

# antlr-tgen, the antlr-ng test case generator

The antlr-tgen test generator tool is designed to simplify the development of an antlr-ng target runtime. It uses a set of test descriptor files (plain text) and generates all the files needed to test a runtime. For each generated test there is:

- One or more grammars, to generate a parser.
- An input file.
- The test (spec) file, which imports the generated parser and runs it with the given input. This file also contains expected output to compare the results of the parse run.

The generation process is (currently) controlled by 2 template files (written in [StringTemplate4](https://github.com/antlr/stringtemplate4/blob/master/doc/index.md) syntax), which determine how the grammar generation from the descriptors and how the final test file looks like. These two files are target language specific and must be provided by the runtime author.

> In the current version of this tool, only existing target languages are supported for test generation. This limitation will be removed when the antlr-ng tool supports external configuration of target languages.

## Installation

For this tool to work you need [Node.js](https://nodejs.org/en) to be installed, which contains a tool named NPM. Once installed you can install `antlr-tgen` as a global command using:

```bash
npm i -g @mike-lischke/antlr-tgen
```

This makes it available as a normal terminal command, which can be used like a bash command.

If you only want to have it in your project where you want to generate the tests set up a typescript project and run

```bash
npm i @mike-lischke/antlr-tgen
```

in its root folder (where `package.json` is located).

It will add a binary command to your project, which can then can be used in an NPM script to run the test generation.

## Usage

Run the generator in your project folder with the following command:

```bash
antlr-tgen --config ./my-config.json
```

where `my-config.json` is the file that contains the details for the generation process.

### Configuration File

The configuration file is a collection of values to guide the generation. Here's an example for the TypeScript runtime:

```json
{
    "language": "TypeScript",
    "targetPath": "./generated/typescript",
    "targetExtension": "ts",
    "testFileName": "Test.spec",
    "grammarTemplateFile": "./templates/TypeScript.grammar.stg",
    "specTemplateFile": "./templates/TypeScript.spec.stg",
    "groupIncludes": [],
    "groupExcludes": [],
    "testIncludes": [],
    "testExcludes": [],
    "testAnnotations": [
        "test",
        "xit"
    ],
    "files": [
        {
            "sourcePattern": "./fixtures/typescript/tsconfig.json",
            "targetPath": "./generated/typescript/"
        }
    ]
}
```

Each fields is described below. Note that all relative paths in the file are relative to the location of the configuration file.

* **language** (mandatory) - The language identifier, which is used to generate the parser/lexer files via antlr-ng.
* **targetPath** (optional, default: `./tests`) - The root path for the generated tests.
* **targetExtension** (mandatory) - The extension to use for the generated test (spec) files.
* **testFileName** (optional, default: `Test`) - The name of the test (spec) file, without the extension.
* **testAnnotations** (optional, default: `none`) - A pair of strings that can be used in the test template to enhance a test method or class (examples are `it`/`xit` for Jest or `@Test`/"" for JUnit). This is subject to change. A simple flag for an enabled or disabled state would do the job as well.
* **grammarTemplateFile** (mandatory) - The path to the template file used to generate the grammar files.
* **specTemplateFile** (mandatory) - The path to the template file used to generate the test (spec) files.
* **groupIncludes** (optional, default: `none`) - A list of regular expressions to filter the list of descriptor groups. Only groups whose names match one of the expressions will be included in the build. If no includes are given, all groups are included.
* **groupExcludes** (optional, default: `none`) - The opposite of the group include list. If a group is listed in both lists, it will be excluded.
* **testIncludes** (optional, default: `none`) - Like `groupIncludes`, but for individual tests. Tests whose group is excluded will be excluded even if they are included in this list.
* **testExcludes** (optional, default: `none`) - Like `groupExcludes`, but removes individual tests from the build list.
* **files** (optional, default: `none`) - A list of files to copy after the build. If a target file already exists, is will be forcibly overwritten.

## Test Structure

The antlr-tgen tool comes with a set of test descriptors, taken from the ANTLR4 runtime-tests, which are organized in folders (as groups) and individual descriptors (one per test). Each of the descriptors contains sections that determine different aspects of a test (main grammar, included grammars, test input, expected output and expected errors).

On execution the generator creates a folder for each group and in that a folder for each test. A test folder receives the grammars that were generated from the descriptor in conjunction with the grammar template file. Then [antlr-ng](https://www.npmjs.com/package/antlr-ng) is used to generate the source files (parser, lexer, listener, visitor, depending on settings in the descriptor). Finally a test file is generated from the spec template that imports the generated files and runs the lexer or parser. The exact structure of the test file is entirely determined by the spec template group file.

## Template Files

As mentioned above there are 2 template group files (*.stg) that control how target files are generated. The first one is for generating grammar files and the second one for generating the test files. antlr-ng uses template files (and the [StringTemplate4](https://github.com/antlr/stringtemplate4/blob/master/doc/index.md) library) to create text content based on certain rules and input values. This allows to use, for example, a generic `<writeln("\"S.A\"")>` in the test descriptors, which is then converted to target specific code (e.g. `console.log("\"S.A\"")` for TypeScript/JavaScript). You are free to specify anything that fits your use case, by adding a template to your template group files (e.g. for TS/JS `writeln(s) ::= <<console.log(<s>);>>`). If you are new to target runtime development check existing template files for what's possible (and needed). Unfortunately, it is not documented which template names ANTLR4 uses when generating parser files, so base your own template file on something existing that is close enough to your own target language.

The test template file, on the other hand, mostly determines how a test looks like, what's included and which values to use for the test itself. It uses conditional templates to include certain parts (e.g. visitors) only when really needed. For example it usually contains this part:

```
<if(!buildParseTree)>
    parser.buildParseTrees = false;
<endif>
```

Here's a list of the values that can be used in the test template group file:

* **grammarName** - The base name of the grammar used for testing. It can be used to derive other names from (e.g. listener and visitor import names).
* **lexerName** - The name of the lexer (for creating a lexer instance).
* **parserName** - The name of the parser (for creating a parser instance).
* **parserStartRuleName** - The name of the start rule to call for the test.
* **showDiagnosticErrors** - A flag that indicates if the `DiagnosticListener` must be added as parse listener, which generates additional information.
* **traceATN** - Not used currently.
* **profile** - Not used currently (always false).
* **showDFA** - A flag that indicates that the DFA must be printed.
* **useListener** - Only used to have the test include the generated listener, which would fail the test if the generated listener has a problem. However, this is not really a runtime test (because the listener is generated by ANTLR).
* **useVisitor** - Ditto for visitors.
* **predictionMode** - The prediction mode to use for parsing (LL or SLL).
* **buildParseTree** - A flag that indicate that the parser has to create a parse tree. However, also this is not being used currently.
* **input** - The input to use for the test.
* **expectedOutput** - This is the value to check against the generated output for the test to succeed or fail.
* **expectedErrors** - Usually empty, but some tests produce expected errors.
* **testAnnotation** - The value of one of the test annotations given in the config file. The first value is used if the is not disabled, otherwise the second one is passed in.

## Test Validation

A test always consists of these steps:

- Parse the given input string.
- Print diagnostic information and/or the DFA to the process standard output, if enabled. Also print errors to the process error output.
- Compare both standard and error output to the given expected values and pass or fail the test based on the outcome.

How to accomplish the last step depends on your target language and how tests in your environment are executed. Java, for example, runs each test in an own process and captures its output, to compare it with the expected values, while TypeScript runs all tests in parallel in its testing framework (antlr4ng uses vitest). You can either do the validation in the generated test file or (manually) create another file that includes all generated test files, compiles them as single binary and run that as a whole (which would probably the best way for compiled languages like C++). In either case you have to set up your testing environment to consume the generated test files somehow.

## Release Notes

See [release-notes.md](./release-notes.md)
