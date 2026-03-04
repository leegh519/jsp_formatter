"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode2 = __toESM(require("vscode"));

// src/formatter.ts
var vscode = __toESM(require("vscode"));
var JSPSimpleFormatter = class {
  provideDocumentFormattingEdits(document, options, token) {
    const edits = [];
    const config = vscode.workspace.getConfiguration("jspFormatter");
    const configuredIndentSize = config.get("indentSize");
    let indentString;
    if (configuredIndentSize && configuredIndentSize > 0) {
      indentString = " ".repeat(configuredIndentSize);
    } else {
      indentString = options.insertSpaces ? " ".repeat(options.tabSize) : "	";
    }
    let currentIndentLevel = 0;
    const voidElements = /* @__PURE__ */ new Set([
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
      "wbr"
    ]);
    let insideScript = false;
    let scriptBaseIndentLevel = 0;
    let jsIndentLevel = 0;
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      let text = line.text.trim();
      if (text.length === 0) {
        if (line.text.length > 0) {
          edits.push(vscode.TextEdit.replace(line.range, ""));
        }
        continue;
      }
      if (insideScript) {
        const isClosingScript = /^<\/script>/i.test(text);
        if (isClosingScript) {
          insideScript = false;
          jsIndentLevel = 0;
          currentIndentLevel = scriptBaseIndentLevel;
          currentIndentLevel = Math.max(0, currentIndentLevel - 1);
          const proposedIndent3 = indentString.repeat(currentIndentLevel);
          const formattedLine3 = proposedIndent3 + text;
          if (line.text !== formattedLine3) {
            edits.push(vscode.TextEdit.replace(line.range, formattedLine3));
          }
          continue;
        }
        const jsLineStartsClose = /^\}/.test(text);
        if (jsLineStartsClose) {
          jsIndentLevel = Math.max(0, jsIndentLevel - 1);
        }
        const totalJsIndent = scriptBaseIndentLevel + jsIndentLevel;
        const proposedIndent2 = indentString.repeat(totalJsIndent);
        const formattedLine2 = proposedIndent2 + text;
        if (line.text !== formattedLine2) {
          edits.push(vscode.TextEdit.replace(line.range, formattedLine2));
        }
        const jsOpenCount = countJsBraces(text, "{");
        const jsCloseCount = countJsBraces(text, "}");
        const netOpen = jsOpenCount - jsCloseCount;
        if (!jsLineStartsClose) {
          jsIndentLevel = Math.max(0, jsIndentLevel + netOpen);
        } else {
          jsIndentLevel = Math.max(
            0,
            jsIndentLevel + jsOpenCount - (jsCloseCount - 1)
          );
        }
        continue;
      }
      let lineStartsCloseTag = false;
      if (text.match(
        /^(<\/[a-zA-Z0-9_:\-]+>|<%--\s*%>|%>|<\/c:[a-zA-Z0-9_\-]+>|-->)/
      )) {
        lineStartsCloseTag = true;
        currentIndentLevel = Math.max(0, currentIndentLevel - 1);
      }
      const proposedIndent = indentString.repeat(currentIndentLevel);
      const formattedLine = proposedIndent + text;
      if (line.text !== formattedLine) {
        edits.push(vscode.TextEdit.replace(line.range, formattedLine));
      }
      if (/^<script(\s[^>]*)?>$/i.test(text)) {
        insideScript = true;
        scriptBaseIndentLevel = currentIndentLevel + 1;
        jsIndentLevel = 0;
        currentIndentLevel += 1;
        continue;
      }
      let lineOpenCount = 0;
      let lineCloseCount = 0;
      let calculationText = text;
      calculationText = calculationText.replace(/<%--.*?--%>/g, "");
      calculationText = calculationText.replace(/<!--.*?-->/g, "");
      const tagRegex = /<(\/?)((?:[a-zA-Z0-9_:\-])+)((?:[^><"']+|"[^"]*"|'[^']*'|<[^>]*>)*)(\/?)?(?<!\/)>|<%(?!@)(!?)|%>|<!--|-->|<%--|-%>/g;
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
          const isSelfClosing = match[4] === "/" || attributes.trim().endsWith("/") || voidElements.has(tagName);
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
};
function countJsBraces(line, brace) {
  let count = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let inLineComment = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (inLineComment) {
      break;
    }
    if (!inSingleQuote && !inDoubleQuote && !inTemplate) {
      if (ch === "/" && next === "/") {
        inLineComment = true;
        continue;
      }
      if (ch === '"') {
        inDoubleQuote = true;
        continue;
      }
      if (ch === "'") {
        inSingleQuote = true;
        continue;
      }
      if (ch === "`") {
        inTemplate = true;
        continue;
      }
    } else if (inDoubleQuote) {
      if (ch === "\\" && next === '"') {
        i++;
        continue;
      }
      if (ch === '"') {
        inDoubleQuote = false;
        continue;
      }
    } else if (inSingleQuote) {
      if (ch === "\\" && next === "'") {
        i++;
        continue;
      }
      if (ch === "'") {
        inSingleQuote = false;
        continue;
      }
    } else if (inTemplate) {
      if (ch === "\\" && next === "`") {
        i++;
        continue;
      }
      if (ch === "`") {
        inTemplate = false;
        continue;
      }
    }
    if (!inSingleQuote && !inDoubleQuote && !inTemplate && ch === brace) {
      count++;
    }
  }
  return count;
}

// src/extension.ts
function activate(context) {
  const formatter = new JSPSimpleFormatter();
  const providerRegistration = vscode2.languages.registerDocumentFormattingEditProvider(
    { language: "jsp", scheme: "file" },
    formatter
  );
  context.subscriptions.push(providerRegistration);
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
