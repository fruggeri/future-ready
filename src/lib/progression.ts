type LevelProgress = {
    level: number;
    xp: number;
    xpIntoLevel: number;
    xpForNextLevel: number;
    progressPercent: number;
};

// Levels become progressively harder.
// XP needed to go from level N to N+1: 200 + 120*(N-1)
function xpToReachLevel(level: number) {
    if (level <= 1) return 0;
    const steps = level - 1;
    // Arithmetic sum: steps/2 * (2*a1 + (steps-1)*d)
    return (steps * (2 * 200 + (steps - 1) * 120)) / 2;
}

export function getLevelProgressFromXp(totalXp: number): LevelProgress {
    const xp = Math.max(0, Math.floor(totalXp));
    let level = 1;

    while (xp >= xpToReachLevel(level + 1)) {
        level += 1;
    }

    const levelStart = xpToReachLevel(level);
    const nextLevelAt = xpToReachLevel(level + 1);
    const xpIntoLevel = xp - levelStart;
    const xpForNextLevel = Math.max(1, nextLevelAt - levelStart);
    const progressPercent = Math.min(100, Math.max(0, Math.round((xpIntoLevel / xpForNextLevel) * 100)));

    return {
        level,
        xp,
        xpIntoLevel,
        xpForNextLevel,
        progressPercent,
    };
}
