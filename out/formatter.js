"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSPSimpleFormatter = void 0;
const vscode = require("vscode");
class JSPSimpleFormatter {
    provideDocumentFormattingEdits(document, options, token) {
        const edits = [];
        // Read the user configuration
        const config = vscode.workspace.getConfiguration("jspFormatter");
        const configuredIndentSize = config.get("indentSize");
        let indentString;
        if (configuredIndentSize && configuredIndentSize > 0) {
            indentString = " ".repeat(configuredIndentSize);
        }
        else {
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
        // <script> 블록 내부 여부 추적
        let insideScript = false;
        // <script> 태그 자체의 들여쓰기 레벨 (JS 블록 indent의 기준)
        let scriptBaseIndentLevel = 0;
        // JS 블록 { } 기반 추가 indent 레벨
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
            // ─── <script> 블록 종료 감지 ────────────────────────────────
            if (insideScript) {
                const isClosingScript = /^<\/script>/i.test(text);
                if (isClosingScript) {
                    // </script> 는 HTML 모드로 복귀, scriptBaseIndentLevel 로 들여쓰기
                    insideScript = false;
                    jsIndentLevel = 0;
                    currentIndentLevel = scriptBaseIndentLevel;
                    // HTML 닫힘 태그이므로 indent 1 감소
                    currentIndentLevel = Math.max(0, currentIndentLevel - 1);
                    const proposedIndent = indentString.repeat(currentIndentLevel);
                    const formattedLine = proposedIndent + text;
                    if (line.text !== formattedLine) {
                        edits.push(vscode.TextEdit.replace(line.range, formattedLine));
                    }
                    continue;
                }
                // ── JS 코드 들여쓰기 처리 ──────────────────────────────────
                // 줄이 } 로 시작하면 먼저 indent 감소
                const jsLineStartsClose = /^\}/.test(text);
                if (jsLineStartsClose) {
                    jsIndentLevel = Math.max(0, jsIndentLevel - 1);
                }
                const totalJsIndent = scriptBaseIndentLevel + jsIndentLevel;
                const proposedIndent = indentString.repeat(totalJsIndent);
                const formattedLine = proposedIndent + text;
                if (line.text !== formattedLine) {
                    edits.push(vscode.TextEdit.replace(line.range, formattedLine));
                }
                // 이 줄의 { / } 개수를 세어 다음 줄 indent 결정
                const jsOpenCount = countJsBraces(text, "{");
                const jsCloseCount = countJsBraces(text, "}");
                // 줄 첫 { 는 이미 이번 줄에 반영되어 있으므로 다음 줄부터 적용
                // 단, 줄 첫 } 는 위에서 이미 처리
                const netOpen = jsOpenCount - jsCloseCount;
                if (!jsLineStartsClose) {
                    jsIndentLevel = Math.max(0, jsIndentLevel + netOpen);
                }
                else {
                    // 첫 } 는 위에서 -1 이미 했으므로, 나머지 net 반영
                    jsIndentLevel = Math.max(0, jsIndentLevel + jsOpenCount - (jsCloseCount - 1));
                }
                continue;
            }
            // ─── HTML / JSP 모드 ─────────────────────────────────────────
            let lineStartsCloseTag = false;
            // Check if line starts with closing tag (ignoring leading <%)
            // Added comment check <!--
            if (text.match(/^(<\/[a-zA-Z0-9_:\-]+>|<%--\s*%>|%>|<\/c:[a-zA-Z0-9_\-]+>|-->)/)) {
                lineStartsCloseTag = true;
                currentIndentLevel = Math.max(0, currentIndentLevel - 1);
            }
            const proposedIndent = indentString.repeat(currentIndentLevel);
            const formattedLine = proposedIndent + text;
            if (line.text !== formattedLine) {
                edits.push(vscode.TextEdit.replace(line.range, formattedLine));
            }
            // <script> 블록 시작 감지 (속성이 있어도 인식)
            if (/^<script(\s[^>]*)?>$/i.test(text)) {
                insideScript = true;
                scriptBaseIndentLevel = currentIndentLevel + 1;
                jsIndentLevel = 0;
                currentIndentLevel += 1; // <script> 자체도 open tag 이므로 +1
                continue;
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
            const tagRegex = /<(\/?)((?:[a-zA-Z0-9_:\-])+)((?:[^><"']+|"[^"]*"|'[^']*'|<[^>]*>)*)(\/?)?(?<!\/)>|<%(?!@)(!?)|%>|<!--|-->|<%--|-%>/g;
            let match;
            while ((match = tagRegex.exec(calculationText)) !== null) {
                const fullTag = match[0];
                if (fullTag.startsWith("<%--") || fullTag === "<!--") {
                    lineOpenCount++;
                }
                else if (fullTag === "--%>" || fullTag === "-->") {
                    lineCloseCount++;
                }
                else if (fullTag.startsWith("<%")) {
                    lineOpenCount++;
                }
                else if (fullTag === "%>") {
                    lineCloseCount++;
                }
                else if (match[2]) {
                    const isClosing = match[1] === "/";
                    const tagName = match[2].toLowerCase();
                    const attributes = match[3] || "";
                    const isSelfClosing = match[4] === "/" ||
                        attributes.trim().endsWith("/") ||
                        voidElements.has(tagName);
                    if (!isSelfClosing) {
                        if (isClosing) {
                            lineCloseCount++;
                        }
                        else {
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
exports.JSPSimpleFormatter = JSPSimpleFormatter;
/**
 * 문자열에서 문자열 리터럴·주석 밖에 있는 brace 문자(`{` 또는 `}`)의 개수를 셉니다.
 */
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
            break; // 나머지 무시
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
        }
        else if (inDoubleQuote) {
            if (ch === "\\" && next === '"') {
                i++;
                continue;
            }
            if (ch === '"') {
                inDoubleQuote = false;
                continue;
            }
        }
        else if (inSingleQuote) {
            if (ch === "\\" && next === "'") {
                i++;
                continue;
            }
            if (ch === "'") {
                inSingleQuote = false;
                continue;
            }
        }
        else if (inTemplate) {
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
//# sourceMappingURL=formatter.js.map