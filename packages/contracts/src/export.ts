export interface StandaloneHtmlExportOptions {
  includeDiagrams?: boolean;
  includeDag?: boolean;
  theme?: 'light' | 'dark';
}

export interface StandaloneHtmlExportResult {
  html: string;
  filename: string;
  totalDocuments: number;
  sizeBytes: number;
  generatedAt: string;
}

export interface GetStandaloneHtmlExportResponse {
  projectId: string;
  exportResult: StandaloneHtmlExportResult;
}
