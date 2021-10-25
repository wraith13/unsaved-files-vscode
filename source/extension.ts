'use strict';
import * as vscode from 'vscode';
import * as vscel from '@wraith13/vscel';
import packageJson from "../package.json";
import localeEn from "../package.nls.json";
import localeJa from "../package.nls.ja.json";
export type LocaleKeyType = keyof typeof localeEn;
const locale = vscel.locale.make(localeEn, { "ja": localeJa });
export module UnsavedFiles
{
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
                    i =>
                    ({
                        label: stripDirectory(i.fileName),
                        resourceUri: i.uri,
                        description: i.isUntitled ?
                            digest(i.getText()):
                            stripFileName
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
                        contextValue: i.isUntitled ? "untitled": "",
                    })
                ):
                [{
                    label: locale.map("noUnsavedFiles.message"),
                }];
        }
        update = () => this.onDidChangeTreeDataEventEmitter.fire(undefined);
    }
    let unsavedFilesProvider = new UnsavedFilesProvider();
    export module Config
    {
        const root = vscel.config.makeRoot(packageJson);
        export module StatusBar
        {
            export const enabled = root.makeEntry<boolean>("unsaved-files.statusBar.enabled", "root-workspace");
            export const noUnsavedFilesStatusLabel = root.makeEntry<string>("unsaved-files.statusBar.noUnsavedFilesStatusLabel", "root-workspace");
            export const anyUnsavedFilesStatusLabel = root.makeEntry<string>("unsaved-files.statusBar.anyUnsavedFilesStatusLabel", "root-workspace");
            export const label = root.makeEntry<string>("unsaved-files.statusBar.label", "root-workspace");
        }
        export module ViewOnExplorer
        {
            export const enabled = root.makeEntry<boolean>("unsaved-files.viewOnExplorer.enabled", "root-workspace");
        }
    }
    const showTextDocument = async (textDocument : vscode.TextDocument) : Promise<vscode.TextEditor> => await vscode.window.showTextDocument
    (
        textDocument,
        undefined
    );
    export const makeCommand = (command: string, withActivate?: "withActivate") =>
        async (node: any) =>
        {
            if (withActivate)
            {
                await vscode.commands.executeCommand("vscode.open", node.resourceUri);
            }
            await vscode.commands.executeCommand(command, node.resourceUri);
        };
    export const initialize = (context : vscode.ExtensionContext): void =>
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
            vscode.commands.registerCommand(`${applicationKey}.revealFileInFinder`, makeCommand("revealFileInOS")),
            vscode.commands.registerCommand(`${applicationKey}.revealFileInExplorer`, makeCommand("revealFileInOS")),
            vscode.commands.registerCommand(`${applicationKey}.copyFilePath`, makeCommand("copyFilePath")),
            vscode.commands.registerCommand(`${applicationKey}.copyRelativeFilePath`, makeCommand("copyRelativeFilePath")),
            vscode.commands.registerCommand(`${applicationKey}.compareFileWith`, makeCommand("workbench.files.action.compareFileWith", "withActivate")),
            vscode.commands.registerCommand(`${applicationKey}.compareWithClipboard`, makeCommand("workbench.files.action.compareWithClipboard", "withActivate")),
            vscode.commands.registerCommand(`${applicationKey}.compareWithSaved`, makeCommand("workbench.files.action.compareWithSaved")),
            vscode.commands.registerCommand(`${applicationKey}.showActiveFileInExplorer`, makeCommand("workbench.files.action.showActiveFileInExplorer", "withActivate")),
            vscode.commands.registerCommand(`${applicationKey}.showView`, showView),
            vscode.commands.registerCommand(`${applicationKey}.hideView`, hideView),
            //  ステータスバーアイテムの登録
            unsavedFilesLabel = vscel.statusbar.createItem
            ({
                alignment: vscode.StatusBarAlignment.Left,
                command: showCommandKey,
                tooltip: locale.map("statusbar.show.tooltip")
            }),
            nextLabel = vscel.statusbar.createItem
            ({
                alignment: vscode.StatusBarAlignment.Left,
                text: "$(triangle-right)",
                command: showNextCommandKey
            }),
            previousLabel = vscel.statusbar.createItem
            ({
                alignment: vscode.StatusBarAlignment.Left,
                text: "$(triangle-left)",
                command: showPreviousCommandKey
            }),
            //  TreeDataProovider の登録
            vscode.window.registerTreeDataProvider(applicationKey, unsavedFilesProvider),
            //  イベントリスナーの登録
            vscode.window.onDidChangeActiveTextEditor(() => updateUnsavedDocumentsOrder()),
            vscode.workspace.onDidOpenTextDocument(() => updateUnsavedDocuments()),
            vscode.workspace.onDidCloseTextDocument(() => updateUnsavedDocuments()),
            vscode.workspace.onDidChangeTextDocument(() => updateUnsavedDocuments()),
            vscode.workspace.onDidSaveTextDocument(() => updateUnsavedDocuments()),
            vscode.workspace.onDidChangeConfiguration
            (
                event =>
                {
                    if (event.affectsConfiguration("unsaved-files"))
                    {
                        onDidChangeConfiguration();
                    }
                }
            )
        );
        updateViewOnExplorer();
        updateUnsavedDocuments();
    };
    const getUnsavedFilesLabelText = () : string =>
    [
        unsavedDocuments.length <= 0 ?
            Config.StatusBar.noUnsavedFilesStatusLabel.get("default-scope"):
            Config.StatusBar.anyUnsavedFilesStatusLabel.get("default-scope"),
        Config.StatusBar.label.get("default-scope"),
        `${unsavedDocuments.length}`
    ].filter(i => 0 < i.length).join(" ");
    const getUnsavedDocumentsSource = () => vscode.workspace.textDocuments.filter(i => i.isDirty || i.isUntitled);
    const updateUnsavedDocuments = () : void =>
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
    };
    const updateUnsavedDocumentsOrder = () : void =>
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
    };
    const onDidChangeConfiguration = () : void =>
    {
        updateViewOnExplorer();
        updateStatusBar();
    };
    export const updateStatusBar = () : void =>
    {
        if (Config.StatusBar.enabled.get("default-scope"))
        {
            if (1 < unsavedDocuments.length && previousUnsavedDocument && nextUnsavedDocument)
            {
                if (undefined === previousLabel.tooltip)
                {
                    unsavedFilesLabel.hide();
                }
                previousLabel.tooltip = locale.map("statusbar.showNext.tooltip").replace(/\{0\}/g, previousUnsavedDocument.fileName);
                previousLabel.show();
                unsavedFilesLabel.text = getUnsavedFilesLabelText();
                unsavedFilesLabel.show();
                nextLabel.tooltip = locale.map("statusbar.showNext.tooltip").replace(/\{0\}/g, nextUnsavedDocument.fileName);
                nextLabel.show();
            }
            else
            {
                previousLabel.tooltip = undefined;
                previousLabel.hide();
                unsavedFilesLabel.text = getUnsavedFilesLabelText();
                unsavedFilesLabel.show();
                nextLabel.tooltip = undefined;
                nextLabel.hide();
            }
        }
        else
        {
            previousLabel.tooltip = undefined;
            previousLabel.hide();
            unsavedFilesLabel.hide();
            nextLabel.tooltip = undefined;
            nextLabel.hide();
        }
    };
    const updateViewOnExplorer = () : void =>
    {
        vscode.commands.executeCommand
        (
            "setContext",
            "showUnsavedFilesViewOnexplorer",
            Config.ViewOnExplorer.enabled.get("default-scope")
        );
    };
    const showNoUnsavedFilesMessage = async () => await vscode.window.showInformationMessage(locale.map("noUnsavedFiles.message"));
    const stripFileName = (path : string) : string => path.substr(0, path.length -stripDirectory(path).length);
    const stripDirectory = (path : string) : string => path.split('\\').reverse()[0].split('/').reverse()[0];
    const digest = (text : string) : string => text.replace(/\s+/g, " ").substr(0, 128);
    const showQuickPickUnsavedDocument = () => vscode.window.showQuickPick
    (
        unsavedDocuments.map
        (
            i =>
            ({
                label: `$(primitive-dot) $(file-text) ${stripDirectory(i.fileName)}`,
                description: i.isUntitled ?
                    digest(i.getText()):
                    stripFileName(i.fileName),
                detail: i.languageId,
                document: i
            })
        ),
        {
            placeHolder: locale.map("selectUnsavedFiles.placeHolder"),
        }
    );
    export const show = async () : Promise<void> =>
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
            const selected = await showQuickPickUnsavedDocument();
            if (selected)
            {
                await showTextDocument(selected.document);
            }
            break;
        }
    };
    export const showNext = async () : Promise<void> =>
    {
        if (nextUnsavedDocument)
        {
            await showTextDocument(nextUnsavedDocument);
        }
        else
        {
            await showNoUnsavedFilesMessage();
        }
    };
    export const showPrevious = async () : Promise<void> =>
    {
        if (previousUnsavedDocument)
        {
            await showTextDocument(previousUnsavedDocument);
        }
        else
        {
            await showNoUnsavedFilesMessage();
        }
    };
    const showView = async () : Promise<void> => await Config.ViewOnExplorer.enabled.set(true);
    const hideView = async () : Promise<void> => await Config.ViewOnExplorer.enabled.set(false);
}
export const activate = (context: vscode.ExtensionContext) : void =>
{
    UnsavedFiles.initialize(context);
};
export const deactivate = () : void =>
{
};
