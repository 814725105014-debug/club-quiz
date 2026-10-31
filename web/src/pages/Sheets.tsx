import { useEffect, useState } from 'react';
import { AdminLayout } from '../components/Layout';
import { Badge, Button, Card, EmptyState, Loading, Select, useToast } from '../components/ui';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { apiErrorMessage, formatDateTime, relativeTime } from '../lib/format';
import { useApi } from '../lib/hooks';
import type { WorkspaceSettings } from '../lib/types';

interface JobRow {
  id: string;
  job_type: string;
  status: string;
  attempts: number;
  last_error: string | null;
  run_after: string;
  created_at: string;
  updated_at: string;
}

interface SheetTable {
  tab: string;
  headers: string[];
  rows: (string | number | null)[][];
  error?: string;
}

export default function Sheets() {
  const toast = useToast();
  const { data: settings } = useApi<WorkspaceSettings>('/admin/settings');
  const tabsApi = useApi<{ tabs: string[]; error?: string }>('/admin/settings/tabs');
  const [tab, setTab] = useState('');
  const [table, setTable] = useState<SheetTable | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [loadingTable, setLoadingTable] = useState(false);
  const jobsApi = useApi<{ jobs: JobRow[] }>('/admin/jobs');
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);

  const tabs = tabsApi.data?.tabs ?? [];
  useEffect(() => {
    if (!tab && tabs.length) setTab(tabs[0]);
  }, [tabs, tab]);

  const loadTable = async (name: string) => {
    setLoadingTable(true);
    setTableError(null);
    try {
      const result = await api.get<SheetTable>(`/admin/sheet/${encodeURIComponent(name)}`);
      setTable(result);
    } catch (err) {
      setTableError(apiErrorMessage(err));
      setTable(null);
    } finally {
      setLoadingTable(false);
    }
  };

  useEffect(() => {
    if (tab) void loadTable(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const syncAll = async () => {
    try {
      const result = await api.post<{ queued: number }>('/admin/sync/all');
      toast(`${result.queued} result row(s) queued for spreadsheet sync.`, 'success');
      jobsApi.reload();
    } catch (err) {
      toast(apiErrorMessage(err), 'error');
    }
  };

  const retry = async (id: string) => {
    try {
      await api.post(`/admin/jobs/${id}/retry`);
      toast('Job re-queued.', 'success');
      jobsApi.reload();
    } catch (err) {
      toast(apiErrorMessage(err), 'error');
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const result = await api.post<{ ok: boolean; message: string; provider: string }>('/admin/settings/test-connection');
      setTest({ ok: result.ok, message: `${result.provider}: ${result.message}` });
      tabsApi.reload();
    } catch (err) {
      setTest({ ok: false, message: apiErrorMessage(err) });
    } finally {
      setTesting(false);
    }
  };

  const columns = table?.headers?.length ? table.headers : null;
  const width = columns?.length ?? Math.max(1, ...(table?.rows.map((r) => r.length) ?? [1]));

  return (
    <AdminLayout
      title="Spreadsheet sync"
      crumb="Workspace · Google Sheets integration"
      actions={
        <>
          <Button size="sm" variant="subtle" onClick={testConnection} loading={testing}>
            Test connection
          </Button>
          <Button size="sm" variant="primary" onClick={syncAll}>
            Sync all results
          </Button>
        </>
      }
    >
      {test ? (
        <div className={`alert ${test.ok ? 'alert-success' : 'alert-error'}`}>
          <span>{test.ok ? '✓' : '!'}</span>
          <span>{test.message}</span>
        </div>
      ) : null}

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="stat">
          <div className="stat-label">Provider</div>
          <div className="stat-value" style={{ fontSize: 20, textTransform: 'capitalize' }}>
            {settings?.workspace.provider.replace('_', ' ') ?? '—'}
          </div>
          <div className="stat-meta">{settings?.workspace.spreadsheetId.slice(0, 18) ?? 'not configured'}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Queue</div>
          <div className="stat-value">
            {(jobsApi.data?.jobs ?? []).filter((j) => j.status === 'pending').length}
          </div>
          <div className="stat-meta">
            {(jobsApi.data?.jobs ?? []).filter((j) => j.status === 'failed').length} failed · jobs retry automatically
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Test mode</div>
          <div className="stat-value" style={{ fontSize: 20 }}>
            {settings?.workspace.emailTestMode ? 'On' : 'Off'}
          </div>
          <div className="stat-meta">Email delivery {settings?.workspace.emailTestMode ? 'redirected to admin' : 'live'}</div>
        </div>
      </div>

      <div className="callout callout-info" style={{ marginBottom: 16 }}>
        <b>Non-destructive by design</b>
        The platform never deletes rows or renames columns. Result rows are upserted by Attempt ID, certificate rows by
        Certificate ID, so retries are safe. Missing columns are detected and reported instead of guessed.
      </div>

      <Card
        title="Spreadsheet browser"
        subtitle="Read-only view of the connected workbook. Editing records happens in Participants, not in Sheets."
        actions={
          <div className="row" style={{ gap: 8 }}>
            <Select value={tab} onChange={(e) => setTab(e.target.value)} style={{ minWidth: 190 }}>
              {tabs.length === 0 ? <option value="">No tabs</option> : null}
              {tabs.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
            <Button size="sm" variant="subtle" onClick={() => tab && void loadTable(tab)}>
              Refresh
            </Button>
          </div>
        }
        noPad
      >
        {tabsApi.data?.error ? <div className="alert alert-warn" style={{ margin: 16 }}>{tabsApi.data.error}</div> : null}
        {loadingTable ? (
          <Loading label="Reading the sheet…" />
        ) : tableError ? (
          <div className="alert alert-error" style={{ margin: 16 }}>{tableError}</div>
        ) : !table || table.rows.length === 0 ? (
          <EmptyState
            icon="▦"
            title="No mirrored rows yet"
            message={
              settings?.workspace.provider === 'mock'
                ? 'In mock provider mode, rows appear here after the platform syncs a result or certificate. Switch to the Apps Script bridge for the live workbook.'
                : 'This tab is empty, or the bridge has not returned any rows.'
            }
          />
        ) : (
          <div className="table-wrap" style={{ maxHeight: 460, overflow: 'auto' }}>
            <table className="table table-compact">
              <thead>
                {columns ? (
                  <tr>
                    {columns.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                ) : null}
              </thead>
              <tbody>
                {table.rows.slice(0, 200).map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {Array.from({ length: width }).map((_, cellIndex) => (
                      <td key={cellIndex} className="tiny">
                        {row[cellIndex] === null || row[cellIndex] === undefined ? '' : String(row[cellIndex])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Sync queue"
        subtitle="Background jobs with exponential backoff. Failures never block the student experience."
        actions={
          <Button size="sm" variant="subtle" onClick={jobsApi.reload}>
            Refresh
          </Button>
        }
        noPad
        className="mt-16"
      >
        {jobsApi.error ? <div className="alert alert-error" style={{ margin: 16 }}>{jobsApi.error}</div> : null}
        {jobsApi.loading && !jobsApi.data ? (
          <Loading label="Loading queue…" />
        ) : (jobsApi.data?.jobs.length ?? 0) === 0 ? (
          <EmptyState icon="↻" title="Queue is clear" message="Result rows, certificates and emails will appear here as jobs." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Updated</th>
                  <th>Last error</th>
                  <th style={{ textAlign: 'right' }} />
                </tr>
              </thead>
              <tbody>
                {jobsApi.data!.jobs.slice(0, 40).map((job) => (
                  <tr key={job.id}>
                    <td>
                      <div className="small mono">{job.job_type}</div>
                      <div className="tiny muted mono">{job.id.slice(0, 14)}</div>
                    </td>
                    <td>
                      <Badge tone={job.status === 'done' ? 'green' : job.status === 'failed' ? 'red' : job.status === 'processing' ? 'blue' : 'amber'}>
                        {job.status}
                      </Badge>
                    </td>
                    <td className="small">{job.attempts}</td>
                    <td>
                      <div className="small">{relativeTime(job.updated_at)}</div>
                      {job.status === 'pending' ? <div className="tiny muted">next {formatDateTime(job.run_after)}</div> : null}
                    </td>
                    <td className="tiny" style={{ maxWidth: '34ch' }}>
                      {job.last_error ?? '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {job.status === 'failed' ? (
                        <Button size="sm" variant="ghost" onClick={() => void retry(job.id)}>
                          <Icon name="spark" size={13} /> Retry
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminLayout>
  );
}
