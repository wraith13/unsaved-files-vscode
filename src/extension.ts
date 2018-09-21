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

    export async function show() : Promise<void>
    {
        const unsavedDocuments = vscode.workspace.textDocuments.filter(i => i.isDirty || i.isUntitled);
        if (unsavedDocuments.length <= 0)
        {
            await vscode.window.showInformationMessage("No unsaved files");
        }
        else
        {
            const selectedFile = await vscode.window.showQuickPick
            (
                unsavedDocuments.map
                (
                    i => pass_through =
                    {
                        "label": i.fileName,
                        "description": "", // `lines:${i.lineCount}`,
                        "detail": i.languageId
                    }
                ),
                {
                    placeHolder: "Select a unsaved file",
                }
            );
            if (selectedFile)
            {
                const selectedDocument = unsavedDocuments.filter(i => i.fileName === selectedFile.label)[0];
                vscode.window.showTextDocument(selectedDocument);
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