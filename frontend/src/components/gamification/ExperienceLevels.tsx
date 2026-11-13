import React from 'react';

interface ExperienceLevelsProps {
    currentPoints: number;
}

const ExperienceLevels: React.FC<ExperienceLevelsProps> = ({ currentPoints }) => {
    // Mock levels data - this could come from backend config ideally
    const levels = [
        { level: 1, name: 'Novice Seeker', minPoints: 0, description: 'Just starting the journey' },
        { level: 2, name: 'Active Applicant', minPoints: 100, description: 'Sending applications regularly' },
        { level: 3, name: 'Job Hunter', minPoints: 300, description: 'Serious about finding a role' },
        { level: 4, name: 'Networking Pro', minPoints: 600, description: 'Building valuable connections' },
        { level: 5, name: 'Interview Master', minPoints: 1000, description: 'Getting callbacks and interviews' },
        { level: 6, name: 'Offer Magnet', minPoints: 1500, description: 'Closing deals and getting offers' },
    ];

    // Calculate current level based on points
    const currentLevelIndex = levels.findIndex((lvl, idx) => {
        const nextLvl = levels[idx + 1];
        return currentPoints >= lvl.minPoints && (!nextLvl || currentPoints < nextLvl.minPoints);
    });

    const currentLevel = levels[currentLevelIndex !== -1 ? currentLevelIndex : 0];
    const nextLevel = levels[currentLevelIndex + 1];

    const pointsForCurrentLevel = currentLevel.minPoints;
    const pointsForNextLevel = nextLevel ? nextLevel.minPoints : currentPoints * 1.5; // fallback
    const pointsInLevel = currentPoints - pointsForCurrentLevel;
    const pointsNeeded = pointsForNextLevel - pointsForCurrentLevel;
    const progressPercent = Math.min((pointsInLevel / pointsNeeded) * 100, 100);

    // Plain readouts: the level as a name and number, progress as lit ticks,
    // the milestones as a list of tick boxes. No trophies.
    const ticks = Math.round(progressPercent / 10);

    return (
        <div className="instrument">
            <span className="label">Level {currentLevel.level}</span>
            <p className="readout mt-2">{currentLevel.name}</p>
            <div className="flex gap-1 mt-4" aria-label={`${Math.round(progressPercent)}% of the way to the next level`}>
                {Array.from({ length: 10 }, (_, i) => (
                    <i key={i} className={`h-3 flex-1 ${i < ticks ? 'bg-arc' : 'bg-engrave'}`} />
                ))}
            </div>
            <p className="stamp mt-2">
                {currentPoints} pts · {nextLevel ? `${nextLevel.minPoints} for ${nextLevel.name}` : 'Top level'}
            </p>

            <h3 className="label mt-6 mb-2">Milestones</h3>
            <ul>
                {levels.map((lvl, i) => {
                    const isUnlocked = currentPoints >= lvl.minPoints;
                    const isCurrent = lvl.level === currentLevel.level;
                    return (
                        <li key={lvl.level} className={`flex items-start gap-3 py-3 ${i ? 'border-t-2 border-engrave' : ''}`}>
                            <span className="tick mt-0.5" data-on={isUnlocked} aria-hidden="true" />
                            <div className="flex-1">
                                <p className={`font-semibold ${isCurrent ? 'text-arc' : isUnlocked ? 'text-ink' : 'text-ink-dim'}`}>{lvl.name}</p>
                                <p className="text-sm text-ink-dim">{lvl.description}</p>
                            </div>
                            <span className="stamp whitespace-nowrap">{lvl.minPoints} pts</span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default ExperienceLevels;
