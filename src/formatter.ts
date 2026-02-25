import * as vscode from "vscode";

export class JSPSimpleFormatter
  implements vscode.DocumentFormattingEditProvider
{
  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.TextEdit[]> {
    const edits: vscode.TextEdit[] = [];

    // Read the user configuration
    const config = vscode.workspace.getConfiguration("jspFormatter");
    const configuredIndentSize = config.get<number | null>("indentSize");

    let indentString: string;
    if (configuredIndentSize && configuredIndentSize > 0) {
      indentString = " ".repeat(configuredIndentSize);
    } else {
      indentString = options.insertSpaces ? " ".repeat(options.tabSize) : "\t";
    }

    let currentIndentLevel = 0;

    // Tags that are explicitly self-closing or empty void elements in HTML
    const voidElements = new Set([
      "area",
      "base",
      "br",
      "col",
      "embed",
      "hr",
      "img",
      "input",
      "link",
      "meta",
      "param",
      "source",
      "track",
      "wbr",
    ]);

    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      let text = line.text.trim();

      if (text.length === 0) {
        if (line.text.length > 0) {
          edits.push(vscode.TextEdit.replace(line.range, ""));
        }
        continue;
      }

      let lineStartsCloseTag = false;
      // Check if line starts with closing tag (ignoring leading <%)
      // Added comment check <!--
      if (
        text.match(
          /^(<\/[a-zA-Z0-9_:\-]+>|<%--\s*%>|%>|<\/c:[a-zA-Z0-9_\-]+>|-->)/,
        )
      ) {
        lineStartsCloseTag = true;
        currentIndentLevel = Math.max(0, currentIndentLevel - 1);
      }

      const proposedIndent = indentString.repeat(currentIndentLevel);
      const formattedLine = proposedIndent + text;

      if (line.text !== formattedLine) {
        edits.push(vscode.TextEdit.replace(line.range, formattedLine));
      }

      let lineOpenCount = 0;
      let lineCloseCount = 0;

      // Improved Regex to capture:
      // JSP: <% ... %> ... <%-- --%>
      // HTML: <!-- ... --> (comments)
      // Tags: <tagName ... > or </tagName>
      // We remove HTML comments first to avoid parsing tags inside comments.

      let calculationText = text;
      // Strip JSP comments <%-- ... --%> from the line just for tag calculation
      calculationText = calculationText.replace(/<%--.*?--%>/g, "");
      // Strip HTML comments <!-- ... --> from the line
      calculationText = calculationText.replace(/<!--.*?-->/g, "");

      const tagRegex =
        /<(\/?)([a-zA-Z0-9_:\-]+)((?:[^><"']+|"[^"]*"|'[^']*'|<[^>]*>)*)(\/?)>|<%(?!@)(!?)|%>|<!--|-->|<%--|--%>/g;

      let match;
      while ((match = tagRegex.exec(calculationText)) !== null) {
        const fullTag = match[0];

        if (fullTag.startsWith("<%--") || fullTag === "<!--") {
          lineOpenCount++;
        } else if (fullTag === "--%>" || fullTag === "-->") {
          lineCloseCount++;
        } else if (fullTag.startsWith("<%")) {
          lineOpenCount++;
        } else if (fullTag === "%>") {
          lineCloseCount++;
        } else if (match[2]) {
          const isClosing = match[1] === "/";
          const tagName = match[2].toLowerCase();
          const attributes = match[3] || "";

          const isSelfClosing =
            match[4] === "/" ||
            attributes.trim().endsWith("/") ||
            voidElements.has(tagName);

          if (!isSelfClosing) {
            if (isClosing) {
              lineCloseCount++;
            } else {
              lineOpenCount++;
            }
          }
        }
      }

      if (lineStartsCloseTag && lineCloseCount > 0) {
        lineCloseCount--;
      }

      currentIndentLevel += lineOpenCount;
      currentIndentLevel -= lineCloseCount;
      currentIndentLevel = Math.max(0, currentIndentLevel);
    }

    return edits;
  }
}
