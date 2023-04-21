import { DOMParser, Document, Element, Node } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
const domParser = new DOMParser();
const parseDom = domParser.parseFromString.bind(domParser);

import secrets from "../secrets.json" assert { type: "json" };
const { instanceUrl, user, password } = secrets;

const SESSION_TOKEN_COOKIE = "PHPSESSID";
const SESSION_TOKEN_REGEX = /PHPSESSID=([^;]+);/;

const DIR_URL_FRAGMENT = "?dir=";

type nullish = null | undefined;
const isElement = (el: unknown): el is Element => el instanceof Element;
const isDocument = (doc: unknown): doc is Document => doc instanceof Document;
const isQueryable = (x: unknown): x is Element | Document => isElement(x) || isDocument(x);
const textOf = (el: Element | nullish): string => el?.textContent?.trim() ?? "";
const hrefOf = (el: Element | nullish): string => el?.getAttribute("href") ?? "";
const srcOf = (el: Element | nullish): string => el?.getAttribute("src") ?? "";
const omit = <T extends Record<any, any>, K extends string & keyof T>(obj: T, ...keys: K[]): Omit<T, K> =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => !(keys as string[]).includes(k))) as any;
const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
const isDef = <T>(x: T | nullish): x is T => x !== undefined && x !== null;
const mapOpt = <S, T>(v: S | nullish, f: (v: S) => T | undefined): T | undefined =>
  v === undefined || v === null ? undefined : f(v);
const parse = <S, T extends S>(x: S, validate: (x: S) => x is T): T | undefined => (validate(x) ? x : undefined);
const querySelector = (el: Node | nullish, selector: string): Element | undefined =>
  parse(
    mapOpt(parse(el, isQueryable), (el) => el.querySelector(selector)),
    isElement
  );
const querySelectorAll = (el: Node | nullish, selector: string): Element[] =>
  (mapOpt(parse(el, isQueryable), (el) => [...el.querySelectorAll(selector)]) ?? []).filter(isElement);

async function urlToDocument(token: string, url: string): Promise<Document> {
  const response = await fetch(url, {
    headers: { cookie: SESSION_TOKEN_COOKIE + "=" + token },
  });
  const text = await response.text();
  const doc = parseDom(text, "text/html");
  if (!doc) throw new Error("Failed to load url");
  return doc;
}

export async function getSessionToken(): Promise<string> {
  const body = "login&user_name=" + encodeURIComponent(user) + "&user_password=" + encodeURIComponent(password);

  const res = await fetch(instanceUrl, {
    method: "post",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  const token = res.headers.get("set-cookie")?.match(SESSION_TOKEN_REGEX)?.[1];

  if (token === undefined) throw new Error("Login failed.");
  return token;
}

// prettier-ignore
export const letters = <const>['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
export type Letter = typeof letters[number];

export async function getAuthorsByLetter(token: string, initial: Letter): Promise<string[]> {
  const doc = await urlToDocument(token, instanceUrl + DIR_URL_FRAGMENT + initial);
  const listing = doc.getElementById("listing");
  const links = querySelectorAll(listing, "a").filter((a) => textOf(a) !== "..");
  const dirs = links.map((a) => new URL(hrefOf(a), instanceUrl).searchParams.get("dir")).filter(isDef);
  return dirs;
}

export interface Author {
  dir: string;
  name: string;
  imageUrl: string;
  description: string;
  books: string[];
}
export async function getAuthorDetail(token: string, dir: string): Promise<Author> {
  const doc1 = await urlToDocument(token, instanceUrl + 'indexAuthor.php?dotaz=' + encodeURIComponent(dir))
  const imageUrl = srcOf(querySelector(doc1, ".author_img"));
  const description = textOf(querySelector(doc1.getElementById("left"), "p"));
  
  const doc2 = await urlToDocument(token, instanceUrl + DIR_URL_FRAGMENT + encodeURIComponent(dir));
  const name = textOf(querySelector(doc2, ".left_content h2"));
  const listing = doc2.getElementById("listing");
  const links = querySelectorAll(listing, "a").filter((a) => textOf(a) !== "..");
  const books = links.map((a) => new URL(hrefOf(a), instanceUrl).searchParams.get("file")).filter(isDef);

  return { dir, name, imageUrl, description, books };
}
