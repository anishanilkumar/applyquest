import React, { useMemo } from 'react';
import { ResponsiveContainer, Sankey, Tooltip, Layer, Rectangle } from 'recharts';
import { JobApplication } from '../../types';
import { effectiveHistory } from '../../utils/stages';

interface ApplicationProcessSankeyProps {
    applications: JobApplication[];
}

// Custom Link component for colored Sankey links
const CustomLink = (props: any) => {
    const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index, payload } = props;

    const color = payload?.fill || '#94A3B8';

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
                fillOpacity={0.5}
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
                fill="#64748B"
                fillOpacity="1"
                stroke="#475569"
                strokeWidth={1}
            />
            <text
                textAnchor={textAnchor}
                x={textX}
                y={y + height / 2}
                fontSize="12"
                fontWeight="600"
                fill="#1F2937"
                dominantBaseline="middle"
            >
                {payload.name}
            </text>
        </Layer>
    );
};

const ApplicationProcessSankey: React.FC<ApplicationProcessSankeyProps> = ({ applications }) => {
    const data = useMemo(() => {
        const nodesSet = new Set<string>();
        const linksMap = new Map<string, number>();

        applications.forEach(app => {
            if (!app.history || app.history.length === 0) {
                nodesSet.add('Applied');
                return;
            }

            effectiveHistory(app).forEach((record) => {
                const source = record.oldStatus || 'Applied';
                const target = record.newStatus;

                nodesSet.add(source);
                nodesSet.add(target);

                const key = `${source}|${target}`;
                linksMap.set(key, (linksMap.get(key) || 0) + 1);
            });
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

        const nodes = Array.from(nodesSet).map(name => ({ name }));
        nodes.sort((a, b) => (statusOrder[a.name] ?? 99) - (statusOrder[b.name] ?? 99));

        // Color mapping for different transition types
        const getLinkColor = (source: string, target: string): string => {
            // Terminal states - red/gray
            if (target === 'Rejected') return '#EF4444'; // Red
            if (target === 'Ghosted') return '#9CA3AF'; // Gray

            // Success path - green
            if (target === 'Offer') return '#22C55E'; // Green
            if (target === 'Final Round') return '#F59E0B'; // Amber/Orange

            // Interview stages - purple/pink
            if (target === 'Technical Round 2') return '#EC4899'; // Pink
            if (target === 'Technical Round 1') return '#A855F7'; // Purple
            if (target === 'Phone Screen') return '#8B5CF6'; // Violet

            // Early stages - blue
            if (target === 'Replied') return '#3B82F6'; // Blue
            if (source === 'Applied') return '#60A5FA'; // Light Blue

            return '#94A3B8'; // Default slate
        };

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
            <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Application Flow</h3>
                <div className="h-64 flex items-center justify-center text-gray-400">
                    Not enough transition data to display Sankey chart
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-800">Application Flow</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Visualizing how applications progress through different stages
                    </p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3B82F6' }}></div>
                        <span className="text-gray-600">Early Stage</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#8B5CF6' }}></div>
                        <span className="text-gray-600">Interview</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#F59E0B' }}></div>
                        <span className="text-gray-600">Advanced</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#22C55E' }}></div>
                        <span className="text-gray-600">Success</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#EF4444' }}></div>
                        <span className="text-gray-600">Rejected</span>
                    </div>
                </div>
            </div>
            <div className="h-[500px] w-full">
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
                                        const color = data.payload.fill || '#3B82F6';

                                        return (
                                            <div className="bg-white p-3 rounded-lg shadow-lg border-l-4" style={{ borderColor: color }}>
                                                <p className="font-semibold text-gray-800">{sourceName} → {targetName}</p>
                                                <p className="text-gray-600">
                                                    <span className="font-bold text-gray-900">{value}</span> application{value !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        );
                                    }

                                    // Check if it is a Node (has name but no source/target in top object)
                                    if (data.payload.name && !data.payload.source) {
                                        const name = data.payload.name;
                                        const value = data.value; // Total value passing through node

                                        return (
                                            <div className="bg-white p-3 rounded-lg shadow-lg border-l-4 border-gray-500">
                                                <p className="font-semibold text-gray-800">{name}</p>
                                                {value !== undefined && (
                                                    <p className="text-gray-600">
                                                        <span className="font-bold text-gray-900">{value}</span> application{value !== 1 ? 's' : ''}
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
