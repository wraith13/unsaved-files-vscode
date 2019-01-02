'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import localeEn from "../package.nls.json";
import localeJa from "../package.nls.ja.json";

interface LocaleEntry
{
    [key : string] : string;
}
const localeTableKey = <string>JSON.parse(<string>process.env.VSCODE_NLS_CONFIG).locale;
const localeTable = Object.assign(localeEn, ((<{[key : string] : LocaleEntry}>{
    ja : localeJa
})[localeTableKey] || { }));
const localeString = (key : string) : string => localeTable[key] || key;

export module UnsavedFiles
{
    let pass_through;

    const applicationKey = "unsaved-files";
    let unsavedDocuments : vscode.TextDocument[] = [];
    let nextUnsavedDocument : vscode.TextDocument | null = null;
    let previousUnsavedDocument : vscode.TextDocument | null = null;

    let unsavedFilesLabel : vscode.StatusBarItem;
    let nextLabel : vscode.StatusBarItem;
    let previousLabel : vscode.StatusBarItem;

    class UnsavedFilesProvider implements vscode.TreeDataProvider<vscode.TreeItem>
    {
        private onDidChangeTreeDataEventEmitter = new vscode.EventEmitter<vscode.TreeItem | undefined>();
        readonly onDidChangeTreeData = this.onDidChangeTreeDataEventEmitter.event;

        getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem>
        {
            return element;
        }
        getChildren(_element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]>
        {
            //  unsavedDocuments は他の処理全般の都合でソートされており、順番がちょくちょく変わって view に表示するのに適さないので getUnsavedDocumentsSource() を直接利用する。
            const unsavedDocumentsSource = getUnsavedDocumentsSource();
            return 0 < unsavedDocumentsSource.length ?
                unsavedDocumentsSource.map
                (
                    i => pass_through =
                    {
                        label: stripDirectory(i.fileName),
                        resourceUri: i.uri,
                        description: stripFileName
                        (
                            vscode.workspace.rootPath ?
                                i.fileName.replace(new RegExp("^" +vscode.workspace.rootPath.replace(/([\!\"\#\$\%\&\'\(\)\~\^\|\\\[\]\{\}\+\*\,\.\/])/g, "\\$1")),""):
                                i.fileName
                        )
                        .replace(/^[\/\\]*/, "")
                        .replace(/[\/\\]*$/, ""),
                        command:
                        {
                            title: "show",
                            command: "vscode.open",
                            arguments:[i.uri]
                        },
                    }
                ):
                [
                    {
                        label: localeString("noUnsavedFiles.message"),
                    }
                ];
        }

        update = () => this.onDidChangeTreeDataEventEmitter.fire();
    }
    let unsavedFilesProvider = new UnsavedFilesProvider();

    function getConfiguration<type>(key? : string, section : string = applicationKey) : type
    {
        const configuration = vscode.workspace.getConfiguration(section);
        return key ?
            configuration[key] :
            configuration;
    }

    const getStatusBarLabel = () : string => getConfiguration<string>("label", `${applicationKey}.statusBar`);
    const getStatusBarEnabled = () : boolean => getConfiguration<boolean>("enabled", `${applicationKey}.statusBar`);
    const getViewOnExplorerEnabled = () : boolean => getConfiguration<boolean>("enabled", `${applicationKey}.viewOnExplorer`);
    const setViewOnExplorerEnabled = async (enabled : boolean) : Promise<void> => await vscode.workspace.getConfiguration(`${applicationKey}.viewOnExplorer`).update("enabled", enabled, true);

    function createStatusBarItem
    (
        properties :
        {
            alignment ? : vscode.StatusBarAlignment,
            text ? : string,
            command ? : string,
            tooltip ? : string
        }
    )
    : vscode.StatusBarItem
    {
        const result = vscode.window.createStatusBarItem(properties.alignment);
        if (undefined !== properties.text)
        {
            result.text = properties.text;
        }
        if (undefined !== properties.command)
        {
            result.command = properties.command;
        }
        if (undefined !== properties.tooltip)
        {
            result.tooltip = properties.tooltip;
        }
        return result;
    }

    async function showTextDocument(textDocument : vscode.TextDocument) : Promise<vscode.TextEditor>
    {
        return await vscode.window.showTextDocument
        (
            textDocument,
            undefined
        );
    }

    export function initialize(context : vscode.ExtensionContext): void
    {
        const showCommandKey = `${applicationKey}.show`;
        const showNextCommandKey = `${applicationKey}.showNext`;
        const showPreviousCommandKey = `${applicationKey}.showPrevious`;

        context.subscriptions.push
        (
            //  コマンドの登録
            vscode.commands.registerCommand(showCommandKey, show),
            vscode.commands.registerCommand(showNextCommandKey, showNext),
            vscode.commands.registerCommand(showPreviousCommandKey, showPrevious),
            vscode.commands.registerCommand(`${applicationKey}.showView`, showView),
            vscode.commands.registerCommand(`${applicationKey}.hideView`, hideView),

            //  ステータスバーアイテムの登録
            unsavedFilesLabel = createStatusBarItem
            (
                {
                    alignment: vscode.StatusBarAlignment.Left,
                    command: showCommandKey,
                    tooltip: localeString("statusbar.show.tooltip")
                }
            ),
            nextLabel = createStatusBarItem
            (
                {
                    alignment: vscode.StatusBarAlignment.Left,
                    text: "$(triangle-right)",
                    command: showNextCommandKey
                }
            ),
            previousLabel = createStatusBarItem
            (
                {
                    alignment: vscode.StatusBarAlignment.Left,
                    text: "$(triangle-left)",
                    command: showPreviousCommandKey
                }
            ),

            //  TreeDataProovider の登録
            vscode.window.registerTreeDataProvider(applicationKey, unsavedFilesProvider),

            //  イベントリスナーの登録
            vscode.window.onDidChangeActiveTextEditor(() => updateUnsavedDocumentsOrder()),
            vscode.workspace.onDidOpenTextDocument(() => updateUnsavedDocuments()),
            vscode.workspace.onDidCloseTextDocument(() => updateUnsavedDocuments()),
            vscode.workspace.onDidChangeTextDocument(() => updateUnsavedDocuments()),
            vscode.workspace.onDidSaveTextDocument(() => updateUnsavedDocuments()),
            vscode.workspace.onDidChangeConfiguration(() => onDidChangeConfiguration())
        );

        updateViewOnExplorer();
        updateUnsavedDocuments();
    }

    const getUnsavedFilesLabelText = () : string =>
    [
        getConfiguration<string>
        (
            unsavedDocuments.length <= 0 ?
                "noUnsavedFilesStatusLabel":
                "anyUnsavedFilesStatusLabel",
            `${applicationKey}.statusBar`
        ),
        getStatusBarLabel(),
        `${unsavedDocuments.length}`
    ].filter(i => 0 < i.length).join(" ");

    const getUnsavedDocumentsSource = () => vscode.workspace.textDocuments.filter(i => i.isDirty || i.isUntitled);
    function updateUnsavedDocuments() : void
    {
        const unsavedDocumentsSource = getUnsavedDocumentsSource();
        const oldUnsavedDocumentsFileName = unsavedDocuments
            .map(i => i.fileName);
        //  既知のドキュメントの情報を新しいオブジェクトに差し替えつつ、消えたドキュメントを間引く
        unsavedDocuments = oldUnsavedDocumentsFileName
            .map(i => unsavedDocumentsSource.find(j => j.fileName === i))
            .filter(i => undefined !== i)
            .map(i => <vscode.TextDocument>i);
        //  既知でないドキュメントのオブジェクトを先頭に挿入
        unsavedDocuments = unsavedDocumentsSource
            .filter(i => oldUnsavedDocumentsFileName.indexOf(i.fileName) < 0)
            .concat(unsavedDocuments);

        updateUnsavedDocumentsOrder();
    }
    
    function updateUnsavedDocumentsOrder() : void
    {
        //  アクティブなドキュメントを先頭へ
        const activeTextEditor = vscode.window.activeTextEditor;
        if (activeTextEditor)
        {
            const activeDocument = activeTextEditor.document;
            if
            (
                (activeDocument.isDirty || activeDocument.isUntitled) &&
                unsavedDocuments[0].fileName !== activeDocument.fileName
            )
            {
                unsavedDocuments = [activeTextEditor.document]
                    .concat(unsavedDocuments.filter(i => i.fileName !== activeDocument.fileName));
            }
        }

        if (0 < unsavedDocuments.length)
        {
            const sortedUnsavedDocuments = unsavedDocuments
                .map(i => i) // 元の配列の順番を壊さない為に一次配列を作成する
                .sort((a, b) => a.fileName.localeCompare(b.fileName));

            const currentIndex = sortedUnsavedDocuments.map(i => i.fileName).indexOf(unsavedDocuments[0].fileName);
            nextUnsavedDocument = sortedUnsavedDocuments[(currentIndex +1) % sortedUnsavedDocuments.length];
            previousUnsavedDocument = sortedUnsavedDocuments[(currentIndex -1 +sortedUnsavedDocuments.length) % sortedUnsavedDocuments.length];
        }
        else
        {
            nextUnsavedDocument = null;
            previousUnsavedDocument = null;
        }

        updateStatusBar();
        unsavedFilesProvider.update();
    }

    function onDidChangeConfiguration() : void
    {
        updateViewOnExplorer();
        updateStatusBar();
    }

    export function updateStatusBar() : void
    {
        if (getStatusBarEnabled())
        {
            if (1 < unsavedDocuments.length && previousUnsavedDocument && nextUnsavedDocument)
            {
                previousLabel.tooltip = localeString("statusbar.showNext.tooltip").replace(/\{0\}/g, previousUnsavedDocument.fileName);
                previousLabel.show();
                unsavedFilesLabel.text = getUnsavedFilesLabelText();
                unsavedFilesLabel.show();
                nextLabel.tooltip = localeString("statusbar.showNext.tooltip").replace(/\{0\}/g, nextUnsavedDocument.fileName);
                nextLabel.show();
            }
            else
            {
                previousLabel.hide();
                unsavedFilesLabel.text = getUnsavedFilesLabelText();
                unsavedFilesLabel.show();
                nextLabel.hide();
            }
        }
        else
        {
            previousLabel.hide();
            unsavedFilesLabel.hide();
            nextLabel.hide();
        }
    }

    function updateViewOnExplorer() : void
    {
        vscode.commands.executeCommand
        (
            "setContext",
            "showUnsavedFilesViewOnexplorer",
            getViewOnExplorerEnabled()
        );
    }

    const showNoUnsavedFilesMessage = async () => await vscode.window.showInformationMessage(localeString("noUnsavedFiles.message"));

    const stripFileName = (path : string) : string => path.substr(0, path.length -stripDirectory(path).length);
    const stripDirectory = (path : string) : string => path.split('\\').reverse()[0].split('/').reverse()[0];
    const digest = (text : string) : string => text.replace(/\s+/g, " ").substr(0, 128);

    export async function show() : Promise<void>
    {
        switch(unsavedDocuments.length)
        {
        case 0:
            await showNoUnsavedFilesMessage();
            break;
        case 1:
            await showTextDocument(unsavedDocuments[0]);
            break;
        default:
            const selected = await vscode.window.showQuickPick
            (
                unsavedDocuments.map
                (
                    i => pass_through =
                    {
                        label: `$(primitive-dot) $(file-text) ${stripDirectory(i.fileName)}`,
                        description: i.isUntitled ?
                            digest(i.getText()):
                            stripFileName(i.fileName),
                        detail: i.languageId,
                        document: i
                    }
                ),
                {
                    placeHolder: localeString("selectUnsavedFiles.placeHolder"),
                }
            );
            if (selected)
            {
                await showTextDocument(selected.document);
            }
            break;
        }
    }
    export async function showNext() : Promise<void>
    {
        if (nextUnsavedDocument)
        {
            await showTextDocument(nextUnsavedDocument);
        }
        else
        {
            await showNoUnsavedFilesMessage();
        }
    }
    export async function showPrevious() : Promise<void>
    {
        if (previousUnsavedDocument)
        {
            await showTextDocument(previousUnsavedDocument);
        }
        else
        {
            await showNoUnsavedFilesMessage();
        }
    }
    const showView = async () : Promise<void> => await setViewOnExplorerEnabled(true);
    const hideView = async () : Promise<void> => await setViewOnExplorerEnabled(false);

    //  dummy for test
    export function roundZoom(value : number) : number
    {
        const cent = 100.0;
        return Math.round(value *cent) /cent;
    }
}

export function activate(context: vscode.ExtensionContext) : void
{
    UnsavedFiles.initialize(context);
}

export function deactivate() : void
{
}