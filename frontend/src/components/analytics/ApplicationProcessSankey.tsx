import React, { useMemo, useRef } from 'react';
import { Download } from 'lucide-react';
import { ResponsiveContainer, Sankey, Tooltip, Layer, Rectangle } from 'recharts';
import { JobApplication, ApplicationHistory } from '../../types';
import { effectiveHistory } from '../../utils/stages';
import { PALETTE as P, stageHex } from '../../utils/statusStyle';

interface ApplicationProcessSankeyProps {
    applications: JobApplication[];
}

// Custom Link component for colored Sankey links
const CustomLink = (props: any) => {
    const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index, payload } = props;

    const color = payload?.fill || P.slate;

    return (
        <Layer key={`CustomLink${index}`}>
            <path
                d={`
                    M${sourceX},${sourceY + linkWidth / 2}
                    C${sourceControlX},${sourceY + linkWidth / 2}
                     ${targetControlX},${targetY + linkWidth / 2}
                     ${targetX},${targetY + linkWidth / 2}
                    L${targetX},${targetY - linkWidth / 2}
                    C${targetControlX},${targetY - linkWidth / 2}
                     ${sourceControlX},${sourceY - linkWidth / 2}
                     ${sourceX},${sourceY - linkWidth / 2}
                    Z
                `}
                fill={color}
                fillOpacity={0.55}
                stroke={color}
                strokeWidth={0}
                strokeOpacity={0.3}
            />
        </Layer>
    );
};

// Custom Node component with labels
const CustomNode = (props: any) => {
    const { x, y, width, height, index, payload, containerWidth } = props;

    const isOut = x + width + 6 > containerWidth;
    const textAnchor = isOut ? 'end' : 'start';
    const textX = isOut ? x - 6 : x + width + 6;

    return (
        <Layer key={`CustomNode${index}`}>
            <Rectangle
                x={x}
                y={y}
                width={width}
                height={height}
                fill={P.slateDim}
                fillOpacity="1"
            />
            <text
                textAnchor={textAnchor}
                x={textX}
                y={y + height / 2}
                fontSize="12"
                fontFamily={FONT}
                fill={P.ink}
                dominantBaseline="middle"
                stroke={P.ground}
                strokeWidth={3}
                strokeLinejoin="round"
                paintOrder="stroke"
            >
                {/* A flat ground-coloured outline (no blur) keeps the label legible
                    where it crosses a link. */}
                {payload.name}
                <tspan fill={P.inkDim}>{` · ${payload.count}`}</tspan>
            </text>
        </Layer>
    );
};

// Links take the colour of the stage they lead into (utils/statusStyle.ts).
const LEGEND = [
    { color: stageHex('Applied', true), label: 'Sent' },
    { color: stageHex('Replied', true), label: 'In conversation' },
    { color: stageHex('Offer', true), label: 'Offer' },
    { color: stageHex('Rejected', true), label: 'Ended' },
];

const FONT = '"Plex Mono", ui-monospace, monospace';

// Renders the chart's SVG onto a canvas with a title and legend, then saves it
// as a PNG. The SVG is serialized standalone, so the font is set explicitly.
const downloadChart = (container: HTMLElement | null) => {
    const svg = container?.querySelector('svg.recharts-surface') as SVGSVGElement | null;
    if (!svg) return;

    const { width, height } = svg.getBoundingClientRect();
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    clone.setAttribute('font-family', FONT);

    const header = 70;
    const scale = 2;
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = (height + header) * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(scale, scale);
        ctx.fillStyle = P.ground;
        ctx.fillRect(0, 0, width, height + header);

        ctx.fillStyle = P.ink;
        ctx.font = `500 16px ${FONT}`;
        ctx.textBaseline = 'top';
        ctx.fillText('APPLICATION FLOW', 24, 20);

        ctx.font = `12px ${FONT}`;
        let x = 24;
        LEGEND.forEach(({ color, label }) => {
            ctx.fillStyle = color;
            ctx.fillRect(x, 50, 10, 10);
            ctx.fillStyle = P.inkDim;
            ctx.fillText(label, x + 14, 49);
            x += 14 + ctx.measureText(label).width + 16;
        });

        ctx.drawImage(img, 0, header, width, height);
        const link = document.createElement('a');
        link.download = `application-flow-${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
};

const ApplicationProcessSankey: React.FC<ApplicationProcessSankeyProps> = ({ applications }) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const data = useMemo(() => {
        const nodesSet = new Set<string>();
        const linksMap = new Map<string, number>();
        // How many applications reached each stage, each counted once. The
        // Sankey's own node value only measures flow, so it misses applications
        // still sitting in Applied and double-counts any that loop back.
        const reached = new Map<string, number>();

        applications.forEach(app => {
            // Shortlisted is no longer part of the flow: a job only enters the
            // chart once it has actually been applied to.
            if (app.status === 'Shortlisted' || app.status === 'Not Applying') return;

            const stages = new Set<string>(['Applied']);

            // Ghosted -> Rejected only means the rejection arrived late, so the
            // application is drawn as rejected straight from where it stood.
            const path: ApplicationHistory[] = [];
            for (const h of effectiveHistory(app)) {
                const prev = path[path.length - 1];
                if (h.oldStatus === 'Ghosted' && h.newStatus === 'Rejected' && prev?.newStatus === 'Ghosted') {
                    path[path.length - 1] = { ...prev, newStatus: 'Rejected' };
                } else {
                    path.push(h);
                }
            }

            path.forEach((record) => {
                let source = record.oldStatus || 'Applied';
                const target = record.newStatus;

                // Shortlisted -> Applied is the entry point, not a transition;
                // a jump straight from Shortlisted to a later stage counts as
                // starting from Applied. Dropping a shortlisted job is skipped.
                if (target === 'Shortlisted') return;
                if (source === 'Shortlisted') {
                    if (target === 'Applied' || target === 'Rejected' || target === 'Ghosted') return;
                    source = 'Applied';
                }

                nodesSet.add(source);
                nodesSet.add(target);
                stages.add(source);
                stages.add(target);

                const key = `${source}|${target}`;
                linksMap.set(key, (linksMap.get(key) || 0) + 1);
            });

            // A job dropped straight from Shortlisted was never applied to.
            const neverApplied = path.length > 0 && path.every(h => h.oldStatus === 'Shortlisted' || h.newStatus === 'Shortlisted')
                && !path.some(h => h.newStatus === 'Applied');
            if (neverApplied) return;

            nodesSet.add('Applied');
            stages.forEach(stage => reached.set(stage, (reached.get(stage) || 0) + 1));
        });

        const statusOrder: Record<string, number> = {
            'Applied': 0,
            'Replied': 1,
            'Phone Screen': 2,
            'Technical Round 1': 3,
            'Technical Round 2': 4,
            'Final Round': 5,
            'Offer': 6,
            'Rejected': 7,
            'Ghosted': 7
        };

        const nodes = Array.from(nodesSet).map(name => ({ name, count: reached.get(name) ?? 0 }));
        nodes.sort((a, b) => (statusOrder[a.name] ?? 99) - (statusOrder[b.name] ?? 99));

        // Color mapping for different transition types
        // A link is coloured by the stage it leads into: sent arc, a person
        // involved gold, Offer green, Rejected and Ghosted slate.
        const getLinkColor = (_source: string, target: string): string => stageHex(target, true);

        const links = Array.from(linksMap.entries()).map(([key, value]) => {
            const [sourceName, targetName] = key.split('|');
            const sourceIndex = nodes.findIndex(n => n.name === sourceName);
            const targetIndex = nodes.findIndex(n => n.name === targetName);

            return {
                source: sourceIndex,
                target: targetIndex,
                value,
                fill: getLinkColor(sourceName, targetName),
                sourceName,
                targetName
            };
        }).filter(link => link.source !== -1 && link.target !== -1);

        return { nodes, links };
    }, [applications]);

    if (data.nodes.length === 0 || data.links.length === 0) {
        return (
            <div className="instrument">
                <h3 className="label">Application Flow</h3>
                <div className="h-64 flex items-center justify-center text-slate">
                    Not enough transition data to display Sankey chart
                </div>
            </div>
        );
    }

    return (
        <div className="instrument">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="label">Application Flow</h3>
                    <p className="text-sm text-ink-dim mt-1">
                        Visualizing how applications progress through different stages
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex flex-wrap gap-3 stamp uppercase">
                        {LEGEND.map(({ color, label }) => (
                            <div key={label} className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5" style={{ backgroundColor: color }}></div>
                                <span className="text-ink-dim">{label}</span>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => downloadChart(chartRef.current)}
                        className="btn"
                        title="Download as PNG"
                    >
                        <Download className="w-4 h-4" strokeWidth={1.6} />
                        Download
                    </button>
                </div>
            </div>
            <div ref={chartRef} className="h-[500px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <Sankey
                        data={data}
                        node={CustomNode}
                        link={CustomLink}
                        margin={{ top: 30, right: 150, bottom: 30, left: 150 }}
                        nodePadding={25}
                        nodeWidth={15}
                    >
                        <Tooltip
                            content={(props) => {
                                const { active, payload } = props;
                                if (active && payload && payload.length) {
                                    // The payload structure can be tricky in Recharts Sankey.
                                    // Typically payload[0] contains the data.
                                    const data = payload[0];

                                    // Check if it is a Link (has source and target)
                                    if (data.payload.source && data.payload.target) {
                                        const sourceName = data.payload.source.name || data.payload.sourceName;
                                        const targetName = data.payload.target.name || data.payload.targetName;
                                        const value = data.value;
                                        const color = data.payload.fill || P.arc;

                                        return (
                                            <div className="bg-ground p-3 border-2 border-engrave" style={{ borderLeft: `6px solid ${color}` }}>
                                                <p className="font-semibold text-ink">{sourceName} → {targetName}</p>
                                                <p className="text-ink-dim">
                                                    <span className="font-bold text-ink">{value}</span> application{value !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        );
                                    }

                                    // Check if it is a Node (has name but no source/target in top object)
                                    if (data.payload.name && !data.payload.source) {
                                        const name = data.payload.name;
                                        const value = data.value; // Total value passing through node

                                        return (
                                            <div className="bg-ground p-3 border-2 border-engrave">
                                                <p className="font-semibold text-ink">{name}</p>
                                                {value !== undefined && (
                                                    <p className="text-ink-dim">
                                                        <span className="font-bold text-ink">{value}</span> application{value !== 1 ? 's' : ''}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    }
                                }
                                return null;
                            }}
                        />
                    </Sankey>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ApplicationProcessSankey;
