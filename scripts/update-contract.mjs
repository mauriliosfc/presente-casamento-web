import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

let contract;
if (process.env.API_URL) {
  const response = await fetch(`${process.env.API_URL}/docs-json`);
  if (!response.ok) throw new Error(`Não foi possível obter OpenAPI de ${process.env.API_URL}/docs-json (HTTP ${response.status}).`);
  contract = await response.json();
} else {
  const source = process.env.API_CONTRACT_FILE ?? resolve(process.cwd(), '../api/openapi/openapi.json');
  contract = JSON.parse(await readFile(source, 'utf8'));
}
await mkdir(new URL('../openapi/', import.meta.url), { recursive: true });
await writeFile(new URL('../openapi/openapi.json', import.meta.url), `${JSON.stringify(contract, null, 2)}\n`);
console.log(`Contrato OpenAPI salvo em openapi/openapi.json (API ${contract.info?.version ?? 'sem versão'}).`);
