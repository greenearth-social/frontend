export function rewriteFunctionRequestPath(
  projectId: string,
  functionName: string,
  requestPath: string,
): string {
  const queryIndex = requestPath.indexOf("?");
  const query = queryIndex >= 0 ? requestPath.slice(queryIndex) : "";
  return `/${projectId}/us-central1/${functionName}${query}`;
}
