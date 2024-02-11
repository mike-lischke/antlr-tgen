/*
 * Copyright (c) 2012-2022 The ANTLR Project. All rights reserved.
 * Use of this file is governed by the BSD 3-clause license that
 * can be found in the LICENSE.txt file in the project root.
 */

export interface IGenerationOptions {
    grammarStr: string;
    parserName?: string;
    lexerName?: string;
    grammarName?: string;
    useListener: boolean;
    useVisitor: boolean;
}

/**
 * This interface represents all the information we need about a single test and is the
 * in-memory representation of a descriptor file
 */
export interface IRuntimeTestDescriptor {
    /** A type in {"Lexer", "Parser", "CompositeLexer", "CompositeParser"} */
    testType: GrammarType;

    /**
     * Return a string representing the name of the target currently testing
     *  this descriptor.
     *  Multiple instances of the same descriptor class
     *  can be created to test different targets.
     */
    name: string;

    notes: string;

    /** Parser input. Return "" if not input should be provided to the parser or lexer. */
    input: string;

    /** Output from executing the parser. Return null if no output is expected. */
    output: string;

    /** Parse errors Return null if no errors are expected. */
    errors: string;

    /** The rule at which parsing should start */
    startRule?: string;

    grammarName: string;
    grammar: string;

    /** List of grammars imported into the grammar */
    slaveGrammars?: Array<[string, string]>;

    /** For lexical tests, dump the DFA of the default lexer mode to stdout */
    showDFA: boolean;

    /** For parsing, engage the DiagnosticErrorListener, dumping results to stderr */
    showDiagnosticErrors: boolean;

    traceATN: boolean;
    predictionMode: string;
    buildParseTree: boolean;
    skipTargets?: Set<string>;
    path?: string;
}

export enum GrammarType {
    Lexer,
    Parser,
    CompositeLexer,
    CompositeParser,
}

/** Structure of a configuration JSON file. All paths are relative to the configuration file. */
export interface IConfiguration {
    /** The language identifier as registered with ANTLRng. */
    language: string;

    /** The file extension to use for generated source files. */
    targetExtension: string;

    /** The path to the template of the test file that's generated for each test case. */
    specTemplateFile: string;

    /** The path to the template for the test grammars. */
    grammarTemplateFile: string;

    /** The path where to store the generated test cases. If not specified `./tests` is assumed. */
    targetPath?: string;

    /** The name of the generated test file (default: "Test.<extension>") */
    testFileName?: string;

    /** A list of 2 values to be used for annotating a test (for an enabled/disabled tests) */
    testAnnotations?: string[];

    /** A regex pattern, specifying groups to include in the generation process. */
    groupIncludes?: string[];

    /**
     * A regex pattern, specifying groups to exclude from the generation process.
     * If a group matches this and the `groupIncludes` pattern, it will be excluded.
     */
    groupExcludes?: string[];

    /** A regex pattern, specifying names of tests to be included in the generation process. */
    testIncludes?: string[];

    /**
     * A regex pattern, specifying tests for exclusion from the generation process.
     * If a test matches this and the `testIncludes` pattern, it will be excluded.
     */
    testExcludes?: string[];

    /**
     * A list of files to copy after the generation. If the target path is not specified, the file will be copied
     * to the root of the target directory. All files end up in the same directory, regardless whether the source
     * pattern affects multiple folders, so make sure there are no name conflicts.
     * The source pattern is a glob pattern.
     */
    files?: Array<{ sourcePattern: string, targetPath?: string; }>;
};
