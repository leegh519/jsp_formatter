import * as vscode from "vscode";
import { JSPSimpleFormatter } from "./formatter";

export function activate(context: vscode.ExtensionContext) {
  const formatter = new JSPSimpleFormatter();

  // Register the formatting provider for JSP files
  const providerRegistration =
    vscode.languages.registerDocumentFormattingEditProvider(
      { language: "jsp", scheme: "file" },
      formatter,
    );

  context.subscriptions.push(providerRegistration);
}

export function deactivate() {}
