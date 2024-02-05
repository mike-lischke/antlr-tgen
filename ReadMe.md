[![GitHub Workflow Status (with event)](https://img.shields.io/github/actions/workflow/status/mike-lischke/antlr-tgen/nodejs.yml?style=for-the-badge&logo=github)](https://github.com/mike-lischke/stringtemplate4ts/actions/workflows/nodejs.yml)

<img src="https://raw.githubusercontent.com/mike-lischke/mike-lischke/master/images/ANTLRng2.svg" title="ANTLR Next Generation" alt="ANTLRng" width="96" height="96"/><label style="font-size: 70%">Part of the Next Generation ANTLR Project</label>

# ANTLR-tgen, the ANTLRng test case generator

The ANTLR-tgen test generator tool is designed to simplify the development of an ANTLR target runtime. It uses a set of test descriptor files (plain text) and generates all the files needed to test a runtime. This usually includes an input file, grammars and the parser/lexer files generated from them, and a source file that uses the generated parser to process the input and compare it with expected output text and errors. The whole test suite is based on this principle: read input, lex and/or parse it, and check the output.

The generation process is controlled by 2 template files (written in [StringTemplate4](https://github.com/antlr/stringtemplate4/blob/master/doc/index.md) syntax), which control the grammar generation from the descriptors and how the final test file looks like. These two files are target language specific and must be provided by the runtime author.

> In the current version of this tool, only existing target languages are supported for test generation, simply because the tool used for parser generation is still the ANTLR4 jar. This limitation will be removed when the ANTLR tool is ported to TypeScript and new languages can be configured using a plugin system.

## Installation

Install the test case generator like any other Node.js package:

```bash
npm i @mike-lischke/antlr-tgen
```

It will add a binary command to your project (or a global command if installed globally), which can then be used to generate the runtime tests.

## Usage

Run the generator in your project folder with the following command:

```bash
antlr-tgen --config ./my-config.json
```

where `my-config.json` is the file that contains the details for the generation process.

### Configuration File

The configuration file is pretty simple. Here's an example for the TypeScript runtime:

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
    "files": [
        {
            "sourcePattern": "./fixtures/typescript/tsconfig.json",
            "targetPath": "./generated/typescript/"
        }
    ]
}
```

Each fields is described below. Note that all relative paths in the file are relative to the location of the configuration file.

* **language** (mandatory) - The language identifier, which is used to generate the parser/lexer files via ANTLR.
* **targetPath** (optional, default: `./tests`) - The root path for the generated tests.
* **targetExtension** (mandatory) - The extension to use for the generated test (spec) files.
* **testFileName** (optional, default: `Test`) - The name of the test (spec) file, without the extension.
* **testAnnotations** (optional, default: `none`) - A pair of strings that can be used in the test template to enhance a test method or class (examples are `it`/`xit` for Jest or `@Test`/`` for JUnit).
* **grammarTemplateFile** (mandatory) - The path to the template file used to generate the grammar files.
* **specTemplateFile** (mandatory) - The path to the template file used to generate the test (spec) files.
* **groupIncludes** (optional, default: `none`) - A list of regular expressions to filter the list of descriptor groups. Only groups whose names match one of the expressions will be included in the build. If no includes are given, all groups are included.
* **groupExcludes** (optional, default: `none`) - The opposite of the group include list. If a group is listed in both lists, it will be excluded.
* **testIncludes** (optional, default: `none`) - Like `groupIncludes`, but for individual tests. Tests whose group is excluded will be excluded even if they are included in this list.
* **testExcludes** (optional, default: `none`) - Like `groupExcludes`, but removes individual tests from the build list.
* **files** (optional, default: `none`) - A list of files to copy after the build. If a target file already exists, is will be forcibly overwritten.

## Test Structure

The ANTLR-tgen tools comes with a set of test descriptors, taken from the ANTLR4 runtime-tests, which are organized in folders (as groups) and individual descriptors (one per test). Each of the descriptors contains sections that determine different aspects of a test (main grammar, included grammars, test input, expected output and expected errors, and so on).

On execution the generator creates a folder for each group and in that a folder for each test. A test folder receives the grammars that were generated from the descriptor in conjunction with the grammar template file. Then ANTLR is used to generate the source files (parser, lexer, listener, visitor, depending on settings in the descriptor). Finally a test file is generated from the spec template that imports the generated files and runs the lexer or parser. The exact structure of the test file is entirely determined by the spec template file.

## Template Files

As mentioned above there are 2 template group files (*.stg) that control how target files are generated. The first one is for generating grammar files and the second one for generating the test files. ANTLR uses template files (and the [StringTemplate4](https://github.com/antlr/stringtemplate4/blob/master/doc/index.md) library) to create text content based on certain rules and input values. This allows to use, for example, a generic `<writeln("\"S.A\"")>` in the test descriptors, which is then converted to target specific code (e.g. `console.log("\"S.A\"")` for TypeScript/JavaScript). You are free to specify anything that fits your use case, by adding a template to your template group files (e.g. for TS/JS `writeln(s) ::= <<console.log(<s>);>>`). If you are new to target runtime development check existing template files for what's possible (and needed). Unfortunately, it is not documented which template names ANTLR uses when generating parser files, so base your own template file on something existing that is close enough to your own target language.

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
* **showDiagnosticErrors** - A flag that indicates if the `DiagnosticListener` must be added as parse listener, which prints additional information to the terminal.
* **traceATN** - Not used currently.
* **profile** - Not used currently (always false).
* **showDFA** - A flag that indicates that the DFA must be printed to the terminal/stdout.
* **useListener** - Only used to have the test include the generated listener, which would fail the test if the generated listener has a problem. However, this is not really a runtime test (because the listener is generated by ANTLR).
* **useVisitor** - Ditto for visitors.
* **predictionMode** - The prediction mode to use for parsing (LL or SLL).
* **buildParseTree** - A flag that indicate that the parser has to create a parse tree. However, also this is not being used currently.
* **input** - The input to use for the test.
* **expectedOutput** - This is the value to check against the generated output for the test to succeed or fail.
* **expectedErrors** - Usually empty, but some tests produce expected errors.

## Test Validation

A test always consists of these steps:

- Parse the given input string.
- Print diagnostic information and/or the DFA to the process standard output, if enabled. Also print errors to the process error output.
- Compare both standard and error output to the given expected values and pass or fail the test based on the outcome.

How to accomplish the last step depends on your target language and how tests in your environment are executed. Java, for example, runs each test in an own process and captures its output, to compare it with the expected values, while TypeScript runs all tests in parallel in its testing framework (antlr4ng uses Jest). You can either do the validation in the generated test file or (manually) create another file that includes all generated test files, compiles them as single binary and run that as a whole (which would probably the best way for compiled languages like C++). In either case you have to set up your testing environment to consume the generated test files somehow.

## Release Notes

### 1.0.0

First public release.
