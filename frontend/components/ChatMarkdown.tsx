"use client";

import React, { useMemo } from "react";

interface ChatMarkdownProps {
  content: string;
  isUser?: boolean;
}

type InlineToken =
  | { type: "text"; content: string }
  | { type: "bold"; content: string }
  | { type: "italic"; content: string }
  | { type: "bold-italic"; content: string }
  | { type: "code"; content: string }
  | { type: "link"; text: string; href: string };

interface TableData {
  header: InlineToken[][];
  rows: InlineToken[][][];
}

type Block =
  | { type: "paragraph"; inline: InlineToken[] }
  | { type: "bullet"; inline: InlineToken[]; isNested?: boolean }
  | { type: "number"; num: string; inline: InlineToken[]; isNested?: boolean }
  | { type: "header"; level: number; inline: InlineToken[] }
  | { type: "divider" }
  | { type: "spacer" }
  | { type: "code-block"; code: string; lang?: string }
  | { type: "table"; data: TableData };

const INLINE_REGEX =
  /(\*\*\*[^*]+?\*\*\*|\*\*[^*]+?\*\*|__[^_]+?__|`[^`]+?`|\*[^*]+?\*|_[^_]+?_|\[[^\]]+?\]\([^)]+?\))/g;

function parseInlineTokens(text: string): InlineToken[] {
  if (!text) return [];
  const parts = text.split(INLINE_REGEX);

  return parts
    .map((part): InlineToken | null => {
      if (!part) return null;

      // Bold + Italic: ***text***
      if (part.startsWith("***") && part.endsWith("***") && part.length > 6) {
        return { type: "bold-italic", content: part.slice(3, -3) };
      }

      // Bold: **text** or __text__
      if (
        (part.startsWith("**") && part.endsWith("**") && part.length > 4) ||
        (part.startsWith("__") && part.endsWith("__") && part.length > 4)
      ) {
        return { type: "bold", content: part.slice(2, -2) };
      }

      // Inline code: `code`
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return { type: "code", content: part.slice(1, -1) };
      }

      // Italic: *text* or _text_
      if (
        (part.startsWith("*") && part.endsWith("*") && part.length > 2) ||
        (part.startsWith("_") && part.endsWith("_") && part.length > 2)
      ) {
        return { type: "italic", content: part.slice(1, -1) };
      }

      // Link: [text](href)
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        return { type: "link", text: linkMatch[1], href: linkMatch[2] };
      }

      return { type: "text", content: part };
    })
    .filter((t): t is InlineToken => t !== null);
}

function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") && t.endsWith("|") && t.includes("|");
}

function isTableDivider(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") && t.endsWith("|") && /^\|[\s\-:|]+\|$/.test(t);
}

function parseBlocks(markdown: string): Block[] {
  if (!markdown) return [];
  const lines = markdown.split(/\r?\n/);
  const blocks: Block[] = [];

  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = "";

  let tableBuffer: string[] = [];

  const flushTable = () => {
    if (tableBuffer.length < 2) {
      // Not a real table, flush as paragraphs
      tableBuffer.forEach((tblLine) => {
        blocks.push({
          type: "paragraph",
          inline: parseInlineTokens(tblLine),
        });
      });
      tableBuffer = [];
      return;
    }

    const rawHeader = tableBuffer[0]
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    const header = rawHeader.map((c) => parseInlineTokens(c));

    const rows: InlineToken[][][] = [];
    const startIdx = isTableDivider(tableBuffer[1]) ? 2 : 1;

    for (let i = startIdx; i < tableBuffer.length; i++) {
      const rawCols = tableBuffer[i]
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      rows.push(rawCols.map((c) => parseInlineTokens(c)));
    }

    blocks.push({
      type: "table",
      data: { header, rows },
    });
    tableBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    // Check code fence: ```
    if (rawLine.trim().startsWith("```")) {
      if (tableBuffer.length > 0) flushTable();
      if (inCodeBlock) {
        blocks.push({
          type: "code-block",
          code: codeBuffer.join("\n"),
          lang: codeLang,
        });
        codeBuffer = [];
        codeLang = "";
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = rawLine.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      continue;
    }

    // Check table row
    if (isTableRow(rawLine)) {
      tableBuffer.push(rawLine);
      continue;
    } else if (tableBuffer.length > 0) {
      flushTable();
    }

    const trimmed = rawLine.trim();

    // Empty line / spacer
    if (!trimmed) {
      if (blocks.length > 0 && blocks[blocks.length - 1].type !== "spacer") {
        blocks.push({ type: "spacer" });
      }
      continue;
    }

    // Horizontal divider: --- or *** or ___
    if (/^(---|___|\*\*\*)$/.test(trimmed)) {
      blocks.push({ type: "divider" });
      continue;
    }

    // Header: #, ##, ###
    const headerMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headerMatch) {
      blocks.push({
        type: "header",
        level: headerMatch[1].length,
        inline: parseInlineTokens(headerMatch[2]),
      });
      continue;
    }

    // Check indent level for bullets/numbers
    const indentMatch = rawLine.match(/^(\s+)/);
    const isNested = Boolean(indentMatch && indentMatch[1].length >= 2);

    // Bullet points: *, -, •, +
    const bulletMatch = trimmed.match(/^([*\-•+])\s+(.+)$/);
    if (bulletMatch) {
      blocks.push({
        type: "bullet",
        isNested,
        inline: parseInlineTokens(bulletMatch[2]),
      });
      continue;
    }

    // Numbered lists: 1. 2. etc.
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      blocks.push({
        type: "number",
        num: numMatch[1],
        isNested,
        inline: parseInlineTokens(numMatch[2]),
      });
      continue;
    }

    // Standard paragraph line
    blocks.push({
      type: "paragraph",
      inline: parseInlineTokens(trimmed),
    });
  }

  if (tableBuffer.length > 0) {
    flushTable();
  }

  // If code block was unclosed at the end
  if (inCodeBlock && codeBuffer.length > 0) {
    blocks.push({
      type: "code-block",
      code: codeBuffer.join("\n"),
      lang: codeLang,
    });
  }

  return blocks;
}

function renderInline(tokens: InlineToken[], isUser: boolean) {
  return tokens.map((token, idx) => {
    switch (token.type) {
      case "bold":
        return (
          <strong
            key={idx}
            className={`font-bold tracking-tight ${
              isUser ? "text-white" : "text-slate-900"
            }`}
          >
            {token.content}
          </strong>
        );
      case "italic":
        return (
          <em
            key={idx}
            className={`italic ${isUser ? "text-slate-200" : "text-slate-700"}`}
          >
            {token.content}
          </em>
        );
      case "bold-italic":
        return (
          <strong
            key={idx}
            className={`font-bold italic tracking-tight ${
              isUser ? "text-white" : "text-slate-900"
            }`}
          >
            {token.content}
          </strong>
        );
      case "code":
        return (
          <code
            key={idx}
            className={`px-1 py-0.5 rounded font-mono text-[11px] ${
              isUser
                ? "bg-slate-800 text-blue-200 border border-slate-700"
                : "bg-slate-200/80 text-blue-700 font-medium border border-slate-300/40"
            }`}
          >
            {token.content}
          </code>
        );
      case "link":
        return (
          <a
            key={idx}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline font-medium ${
              isUser
                ? "text-blue-300 hover:text-blue-200"
                : "text-blue-600 hover:text-blue-700"
            }`}
          >
            {token.text}
          </a>
        );
      case "text":
      default:
        return <React.Fragment key={idx}>{token.content}</React.Fragment>;
    }
  });
}

export function ChatMarkdown({ content, isUser = false }: ChatMarkdownProps) {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <div className="space-y-1.5 leading-relaxed text-xs">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "header":
            return (
              <div
                key={idx}
                className={`font-bold text-[11px] uppercase font-mono tracking-wider pt-2 pb-0.5 ${
                  isUser
                    ? "text-white border-b border-slate-700"
                    : "text-slate-900 border-b border-slate-200/80"
                }`}
              >
                {renderInline(block.inline, isUser)}
              </div>
            );

          case "bullet":
            return (
              <div
                key={idx}
                className={`flex items-start gap-2 my-0.5 ${
                  block.isNested ? "pl-4" : "pl-0.5"
                }`}
              >
                <span
                  className={`font-bold text-sm leading-[18px] select-none shrink-0 ${
                    isUser ? "text-blue-400" : "text-blue-600"
                  }`}
                >
                  •
                </span>
                <div className="flex-1 min-w-0">
                  {renderInline(block.inline, isUser)}
                </div>
              </div>
            );

          case "number":
            return (
              <div
                key={idx}
                className={`flex items-start gap-2 my-0.5 ${
                  block.isNested ? "pl-4" : "pl-0.5"
                }`}
              >
                <span
                  className={`font-mono text-[10px] font-bold leading-5 select-none shrink-0 ${
                    isUser ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {block.num}.
                </span>
                <div className="flex-1 min-w-0">
                  {renderInline(block.inline, isUser)}
                </div>
              </div>
            );

          case "code-block":
            return (
              <div key={idx} className="my-1.5 rounded-md overflow-hidden border border-slate-800">
                {block.lang && (
                  <div className="bg-slate-950 px-2.5 py-1 text-[10px] font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    {block.lang}
                  </div>
                )}
                <pre className="bg-slate-900 text-slate-100 p-2.5 font-mono text-[11px] overflow-x-auto leading-snug">
                  <code>{block.code}</code>
                </pre>
              </div>
            );

          case "table":
            return (
              <div
                key={idx}
                className="my-2 overflow-x-auto rounded border border-slate-200"
              >
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr
                      className={
                        isUser
                          ? "bg-slate-800 text-slate-200"
                          : "bg-slate-100/90 text-slate-700"
                      }
                    >
                      {block.data.header.map((colTokens, hIdx) => (
                        <th
                          key={hIdx}
                          className="px-2.5 py-1.5 font-semibold border-b border-slate-200 font-mono text-[10px] uppercase"
                        >
                          {renderInline(colTokens, isUser)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {block.data.rows.map((rowTokens, rIdx) => (
                      <tr
                        key={rIdx}
                        className={
                          rIdx % 2 === 1
                            ? isUser
                              ? "bg-slate-850"
                              : "bg-slate-50/50"
                            : ""
                        }
                      >
                        {rowTokens.map((cellTokens, cIdx) => (
                          <td key={cIdx} className="px-2.5 py-1.5 align-top">
                            {renderInline(cellTokens, isUser)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case "divider":
            return (
              <div
                key={idx}
                className={`my-2 border-b ${
                  isUser ? "border-slate-700" : "border-slate-200"
                }`}
              />
            );

          case "spacer":
            return <div key={idx} className="h-1" />;

          case "paragraph":
          default:
            return (
              <div key={idx} className="my-0.5">
                {renderInline(block.inline, isUser)}
              </div>
            );
        }
      })}
    </div>
  );
}
export default ChatMarkdown;
