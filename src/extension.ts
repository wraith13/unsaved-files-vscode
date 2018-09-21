'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

export module UnsavedFiles
{
    let pass_through;

    export function registerCommand(context : vscode.ExtensionContext): void
    {
        context.subscriptions.push
        (
            vscode.commands.registerCommand
            (
                'unsaved-files.show', show
            )
        );
    }

    const stripFileName = (path : string) : string => path.substr(0, path.length -stripDirectory(path).length);
    const stripDirectory = (path : string) : string => path.split('\\').reverse()[0].split('/').reverse()[0];
    const digest = (text : string) : string => text.replace(/\s+/g, " ").substr(0, 128);

    export async function show() : Promise<void>
    {
        const unsavedDocuments = vscode.workspace.textDocuments.filter(i => i.isDirty || i.isUntitled);
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
                        label: stripDirectory(i.fileName),
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