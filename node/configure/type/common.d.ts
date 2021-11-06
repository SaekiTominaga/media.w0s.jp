/* tslint:disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export type HTTP = number;
export type StrictTransportSecurity = string;
export type ContentSecurityPolicyHTML = string;
export type ContentSecurityPolicyHTML1 = string;
export type Threshold = string;
export type NoName4 = string;
export type NoName6 = string;
export type NoName7 = string;
export type NoName8 = string;
export type NoName9 = string[];
export type NoName10 = string[];
export type NoName12 = string[];
export type NoName13 = string[];
export type NoName15 = string;
export type NoName17 = string[];
export type NoName18 = string;
export type NoName16 = {
  paths: NoName17;
  value: NoName18;
}[];
export type NoName20 = string[];
export type NoName21 = string;
export type NoName19 = {
  extensions: NoName20;
  value: NoName21;
}[];
export type FilepathFor403Forbidden = string;
export type FilepathFor404NotFound = string;
export type NoName23 = string;
export type NoName25 = string;
export type Htpasswd = string;
export type NoName27 = number;
export type DBNode = string;

export interface MediaW0SJp {
  port: HTTP;
  response: NoName;
  static: NoName3;
  errorpage: NoName22;
  logger: Logger;
  auth: NoName24;
  sqlite: SQLite;
}
export interface NoName {
  header: NoName1;
  compression: NoName2;
}
export interface NoName1 {
  hsts: StrictTransportSecurity;
  csp: ContentSecurityPolicyHTML;
  csp_html: ContentSecurityPolicyHTML1;
}
export interface NoName2 {
  threshold: Threshold;
}
export interface NoName3 {
  root: NoName4;
  directory: NoName5;
  extensions?: NoName9;
  indexes?: NoName10;
  headers: NoName11;
}
export interface NoName5 {
  image: NoName6;
  audio: NoName7;
  video: NoName8;
}
export interface NoName11 {
  mime: MIME;
  cache_control?: NoName14;
}
export interface MIME {
  path: MIME1;
  extension: MIME2;
}
export interface MIME1 {
  [k: string]: NoName12;
}
export interface MIME2 {
  [k: string]: NoName13;
}
export interface NoName14 {
  default: NoName15;
  path: NoName16;
  extension: NoName19;
}
export interface NoName22 {
  path_403: FilepathFor403Forbidden;
  path_404: FilepathFor404NotFound;
}
export interface Logger {
  path: NoName23;
}
export interface NoName24 {
  realm: NoName25;
  htpasswd_file: Htpasswd;
  json_401: JSON;
}
export interface JSON {
  [k: string]: unknown;
}
export interface SQLite {
  errno: NoName26;
  db: DB;
}
export interface NoName26 {
  [k: string]: NoName27;
}
export interface DB {
  [k: string]: DBNode;
}
