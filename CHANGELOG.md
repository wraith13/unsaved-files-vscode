# Change Log

All notable changes to the "unsaved-files-vscode" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## 2.1.5 - 2025-07-10

### Fixed

- Fixed an issue where the context menu was displayed in the views of other extensions.

### Security

- npm audit fix

## 2.1.4 - 2024-05-19

### Fixed

- Fix typo in `Reval` -> `Reveal`

### Removed

- VSMarketplaceBadges in README.md. ( To avoid an issue where updates cannot be released to the marketplace due to a VSMarketplaceBadges server failure. )

### Security

- npm audit fix

## 2.1.3 - 2022-07-16

### Added

- Also released on [github.com](https://github.com/wraith13/unsaved-files-vscode/releases)
- VSIX download link in README.md

### Fixed

- Fix typo in README.md [PR #10](https://github.com/wraith13/unsaved-files-vscode/pull/10) ( by @happymacarts )

### Security

- npm audit fix

## 2.1.2 - 2021-10-25

### Added

- Supported Web platform. ( `vscode.dev` )
- context menu in view on explorer.

### Changed

- `activationEvents`: `*` -> `onStartupFinished`
- Updated internal package.

### Security

- npm audit fix

## 2.1.1 - 2019-07-11

### Fixed

- Fixed an issue that the order of the items on the status bar was broken with VS Code v1.36 or later.

## 2.1.0 - 2019-06-13

### Added

- show untitled document digest in view on explorer.

### Fixed

- Fixed an issue that the header does not display correctly in the extended information display in VS Code.

## 2.0.0 - 2019-01-03

### Added

- show unsaved files in view on explorer.

## 1.6.0 - 2018-10-26

### Changed

- changed behavior of Show Next/Previous when there is only one unsaved file.

### Fixed

- fixed spelling error of the word "previous" in the command palette.( Thanks @kneckinator )

## 1.5.1 - 2018-10-08

### Changed

- improved behavior when there is only one unsaved file.

## 1.5.0 - 2018-10-05

### Added

- support Japanese.

### Changed

- changed behavior when there is only one unsaved file.

### Fixed

- fixed Show Next/Previous status bar buttons do not disappear bug.

## 1.4.0 - 2018-09-25

### Added

- Show Next/Previous commnads and status bar buttons.

## 1.3.0 - 2018-09-24

### Changed

- Sort unsaved files list by last acces.
- improved unsaved files list display.

## 1.2.0 - 2018-09-23

### Added

- unsaved files status label on status bar.

### Changed

- default `unsaved-files.statusBar.label` setting value: "unsaved" -> "unsaved:"

## 1.1.0 - 2018-09-22

### Added

- UI on status bar.

## 1.0.0 - 2018-09-21

### Added

- Initial release of Unsaved Files.

## [Unreleased]

## 0.0.0 - 2018-09-21

### Added

- Start this project.
