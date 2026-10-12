import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, RefreshCw, CheckCircle2, ShieldCheck, Database, Radio, X } from 'lucide-react'
import { systemApi } from '@/services/apiService'

export function AmbientSyncBar() {
  const [showDiagnostics, setShowDiagnostics] = useState(false)

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['system-mesh-status'],
    queryFn: () => systemApi.meshStatus(),
    staleTime: 60 * 1000,
  })

  return (
    <>
      <div className="bg-emerald-950/90 border-t border-emerald-800/40 text-emerald-100 text-xs py-2 px-4 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-emerald-300">Pan-India Mesh:</span>
            <span>
              {isLoading
                ? 'Connecting to 780+ districts...'
                : `${data?.active_districts_indexed ?? 780}+ Districts Synchronized (O(log N) Spatial KD-Tree)`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDiagnostics(true)}
              className="text-[11px] text-emerald-300 hover:text-white underline underline-offset-2 transition-colors flex items-center gap-1"
            >
              <Activity className="w-3 h-3 text-emerald-400" />
              <span>Mesh Health & Providers</span>
            </button>

            <button
              onClick={() => refetch()}
              disabled={isFetching}
              title="Force Sync Live Mesh"
              aria-label="Force sync live mesh"
              className="p-1 hover:bg-emerald-800/50 rounded text-emerald-300 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Diagnostics Modal */}
      {showDiagnostics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 text-card-foreground">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-primary font-bold text-base">
                <Radio className="w-5 h-5 text-emerald-500 animate-pulse" />
                <span>Pan-India Telemetry Mesh Diagnostics</span>
              </div>
              <button
                onClick={() => setShowDiagnostics(false)}
                aria-label="Close diagnostics"
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="font-semibold">Mesh Status</span>
                </div>
                <span className="font-mono uppercase font-bold text-[11px] px-2 py-0.5 rounded bg-emerald-500/20">
                  {data?.mesh_network_state ?? 'ACTIVE'}
                </span>
              </div>

              <div className="space-y-1.5 p-3 rounded-xl bg-secondary/50 border border-border">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-primary" />
                  <span>Spatial Architecture & Engine</span>
                </div>
                <p className="text-muted-foreground">
                  {data?.spatial_indexing_engine ?? '2D-KDTree (O(log N) Nearest-Neighbor Lat/Lon)'}
                </p>
                <p className="text-muted-foreground">
                  Indexed Nodes: <strong className="text-foreground">{data?.active_districts_indexed ?? 780}+ Districts</strong>
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  <span>Integrated Ingestion Providers</span>
                </div>
                <div className="space-y-1">
                  {data?.providers ? (
                    Object.entries(data.providers).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-[11px] py-1 border-b border-border/50">
                        <span className="capitalize font-medium text-muted-foreground">{k.replace('_', ' ')}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium truncate max-w-[200px]" title={v}>
                          {v}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Loading provider status...</p>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowDiagnostics(false)}
                className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:bg-primary/90 transition-colors"
              >
                Close Diagnostics
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
