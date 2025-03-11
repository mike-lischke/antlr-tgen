<p align="center">
<img src="https://raw.githubusercontent.com/mike-lischke/website-antlr-ng/main/src/assets/images/antlr-ng-logo5.svg" title="ANTLR Next Generation" alt="antlr-ng the parser generator" height="200"/><br/>
<label style="font-size: 90%">Part of the Next Generation ANTLR Project</label>
</p>
<hr />


# antlr-tgen Release Notes

## 1.0.12

The config-schema.json file must be included in the package to run the test generator.

## 1.0.11

- The generator now uses the antlr-ng tool in code (instead of starting a full process with the command line script). This speeds up the generation from 130s to just 9s.
- The tool now returns the exit codes 0 by default and 1 if something went wrong.
- Silent mode can now also suppress errors. By default (no silent or verbose mode) errors and warnings are shown.

## 1.0.10

antlr-tgen now full runs on antlr-ng

## 1.0.8 - 1.0.9

Upgraded dependencies.

## 1.0.7

Fixed path handling + repository clean up.

## 1.0.0 - 1.0.6

First public release + several attempts to get the package running as intended.
