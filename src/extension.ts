'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

export module UnsavedFiles
{
    let pass_through;

    const applicationKey = "unsaved-files";
    let unsavedDocuments : vscode.TextDocument[] = [];

    var unsavedFilesLabel : vscode.StatusBarItem;

    function getConfiguration<type>(key? : string, section : string = applicationKey) : type
    {
        const configuration = vscode.workspace.getConfiguration(section);
        return key ?
            configuration[key] :
            configuration;
    }

    const getStatusBarLabel = () : string => getConfiguration<string>("label", `${applicationKey}.statusBar`);
    const getStatusBarEnabled = () : boolean => getConfiguration<boolean>("enabled", `${applicationKey}.statusBar`);

    export function registerCommand(context : vscode.ExtensionContext): void
    {
        const showCommandKey = `${applicationKey}.show`;
        context.subscriptions.push(vscode.commands.registerCommand(showCommandKey, show));

        unsavedFilesLabel = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        unsavedFilesLabel.command = showCommandKey;
        context.subscriptions.push(unsavedFilesLabel);

        vscode.workspace.onDidOpenTextDocument(() => updateStatusBar());
        vscode.workspace.onDidCloseTextDocument(() => updateStatusBar());
        vscode.workspace.onDidChangeTextDocument(() => updateStatusBar());
        vscode.workspace.onDidSaveTextDocument(() => updateStatusBar());
        vscode.workspace.onDidChangeConfiguration(() => updateStatusBar());
        updateStatusBar();
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

    function updateUnsavedDocuments() : void
    {
        const unsavedDocumentsSource = vscode.workspace.textDocuments.filter(i => i.isDirty || i.isUntitled);
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

        //  アクティブなドキュメントを先頭へ
        var activeTextEditor = vscode.window.activeTextEditor;
        if (activeTextEditor)
        {
            var activeDocument = activeTextEditor.document;
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
    }

    export function updateStatusBar() : void
    {
        updateUnsavedDocuments();

        if (getStatusBarEnabled())
        {
            unsavedFilesLabel.text = getUnsavedFilesLabelText();
            unsavedFilesLabel.show();
        }
        else
        {
            unsavedFilesLabel.hide();
        }
    }

    const stripFileName = (path : string) : string => path.substr(0, path.length -stripDirectory(path).length);
    const stripDirectory = (path : string) : string => path.split('\\').reverse()[0].split('/').reverse()[0];
    const digest = (text : string) : string => text.replace(/\s+/g, " ").substr(0, 128);

    export async function show() : Promise<void>
    {
        if (unsavedDocuments.length <= 0)
        {
            await vscode.window.showInformationMessage("No unsaved files");
        }
        else
        {
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
                    placeHolder: "Select a unsaved file",
                }
            );
            if (selected)
            {
                vscode.window.showTextDocument(selected.document);
            }
        }
    }

    //  dummy for test
    export function roundZoom(value : number) : number
    {
        const cent = 100.0;
        return Math.round(value *cent) /cent;
    }
}

export function activate(context: vscode.ExtensionContext) : void
{
    UnsavedFiles.registerCommand(context);
}

export function deactivate() : void
{
}