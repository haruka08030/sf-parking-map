const DAY_MAP = {
    SU: 0, MO: 1, M: 1, TU: 2, WE: 3, W: 3, TH: 4, FR: 5, F: 5, SA: 6,
};

/**
 * Parses a day string like "M-F", "SA,SU" into a Set of day numbers (0=Sun).
 * @param {string} str The day string from the dataset.
 * @returns {Set<number> | null} A set of day numbers or null if empty/invalid.
 */
export function parseDays(str) {
    if (!str || typeof str !== 'string') return null;

    const days = new Set();
    const parts = str.toUpperCase().split(/[,;\s]+/);

    for (const part of parts) {
        if (part.includes('-')) {
            const [startStr, endStr] = part.split('-');
            const start = DAY_MAP[startStr.trim()];
            const end = DAY_MAP[endStr.trim()];
            if (start !== undefined && end !== undefined) {
                for (let i = start; i <= end; i++) {
                    days.add(i);
                }
            }
        } else {
            const day = DAY_MAP[part.trim()];
            if (day !== undefined) {
                days.add(day);
            }
        }
    }
    return days.size > 0 ? days : null;
}

/**
 * Parses a time string into minutes from midnight.
 * Handles "HHMM-HHMM", "8am-7pm", "09:00-18:00", "ANYTIME".
 * @param {string} str The time string.
 * @returns {{startMin: number, endMin: number} | null}
 */
export function parseTimeRange(str) {
    if (!str || typeof str !== 'string' || str.toUpperCase().includes('ANYTIME') || str.toUpperCase().includes('24 HR')) {
        return { startMin: 0, endMin: 1440 };
    }

    const cleaned = str.toLowerCase().replace(/\s/g, '');

    // Priority 1: HHMM-HHMM format (e.g., "0900-1800")
    let match = cleaned.match(/^(\d{3,4})-(\d{3,4})$/);
    if (match) {
        const startStr = match[1].padStart(4, '0');
        const endStr = match[2].padStart(4, '0');
        const startHour = parseInt(startStr.substring(0, 2), 10);
        const startMin = parseInt(startStr.substring(2, 4), 10);
        const endHour = parseInt(endStr.substring(0, 2), 10);
        const endMin = parseInt(endStr.substring(2, 4), 10);
        return { startMin: startHour * 60 + startMin, endMin: endHour * 60 + endMin };
    }

    // Priority 2: More complex am/pm format (e.g., "8am-6pm", "9:30am-5pm")
    match = cleaned.match(/^(\d{1,2})(:?(\d{2}))?(am|pm)?-(\d{1,2})(:?(\d{2}))?(am|pm)?$/);
    if (match) {
        let [, h1, m1, ampm1, h2, m2, ampm2] = match;

        let startHour = parseInt(h1, 10);
        let startMin = parseInt(m1 || '0', 10);
        let endHour = parseInt(h2, 10);
        let endMin = parseInt(m2 || '0', 10);

        if (ampm1 === 'pm' && startHour < 12) startHour += 12;
        if (ampm1 === 'am' && startHour === 12) startHour = 0; // Midnight case
        if (ampm2 === 'pm' && endHour < 12) endHour += 12;
        if (ampm2 === 'am' && endHour === 12) endHour = 0;

        if (ampm2 && !ampm1) {
            if (endHour < startHour || (endHour === startHour && endMin < startMin)) {
                if (startHour < 12) startHour += 12;
            }
        }
        return { startMin: startHour * 60 + startMin, endMin: endHour * 60 + endMin };
    }

    return null; // Return null if no format matches
}


/**
 * Checks if a regulation is active at a specific date and time.
 * @param {object} props The feature properties.
 * @param {Date} date The date to check against.
 * @returns {boolean} True if the regulation is active.
 */
export function isActiveAt(props, date) {
    const activeDays = parseDays(props.days);
    const timeRange = parseTimeRange(props.hours);
    const dayOfWeek = date.getDay();
    const nowMinutes = date.getHours() * 60 + date.getMinutes();

    // No day or time restriction means active
    if (!activeDays && !timeRange) return true;

    // Only time is restricted (assume active every day)
    if (!activeDays && timeRange) {
        if (timeRange.endMin <= timeRange.startMin) { // Overnight
            return nowMinutes >= timeRange.startMin || nowMinutes < timeRange.endMin;
        } else { // Same day
            return nowMinutes >= timeRange.startMin && nowMinutes < timeRange.endMin;
        }
    }

    // Only day is restricted
    if (activeDays && !timeRange) {
        return activeDays.has(dayOfWeek);
    }

    // Both day and time are restricted
    if (activeDays && timeRange) {
        const yesterday = (dayOfWeek - 1 + 7) % 7;
        if (timeRange.endMin <= timeRange.startMin) { // Overnight rule
            if (activeDays.has(yesterday) && nowMinutes < timeRange.endMin) return true; // After midnight, from yesterday's rule
            if (activeDays.has(dayOfWeek) && nowMinutes >= timeRange.startMin) return true; // Before midnight, from today's rule
            return false;
        } else { // Same day rule
            return activeDays.has(dayOfWeek) && nowMinutes >= timeRange.startMin && nowMinutes < timeRange.endMin;
        }
    }

    return false;
}

/**
 * Checks if a regulation intersects with a given time range.
 * For now, assumes the user range is within the same day.
 * @param {object} props The feature properties.
 * @param {Date} start The start of the range.
 * @param {Date} end The end of the range.
 * @returns {boolean} True if there is any overlap.
 */
export function intersectsRange(props, start, end) {
    const activeDays = parseDays(props.days);
    const regTime = parseTimeRange(props.hours);
    const dayOfWeek = start.getDay(); // Assuming same-day range for now

    // Check if rule is active on the day of the range
    if (activeDays && !activeDays.has(dayOfWeek)) {
        // A full implementation would check for overnight rules from the previous day
        return false;
    }

    // If no time rule, it's active all day, so it intersects
    if (!regTime) return true;

    const userStartMin = start.getHours() * 60 + start.getMinutes();
    const userEndMin = end.getHours() * 60 + end.getMinutes();

    if (regTime.endMin <= regTime.startMin) { // Regulation is overnight
        const ruleRange1 = { start: regTime.startMin, end: 1440 }; // to midnight
        const ruleRange2 = { start: 0, end: regTime.endMin }; // from midnight
        const userRange = { start: userStartMin, end: userEndMin };

        const overlaps1 = Math.max(ruleRange1.start, userRange.start) < Math.min(ruleRange1.end, userRange.end);
        const overlaps2 = Math.max(ruleRange2.start, userRange.start) < Math.min(ruleRange2.end, userRange.end);
        return overlaps1 || overlaps2;

    } else { // Regulation is same-day
        const ruleRange = { start: regTime.startMin, end: regTime.endMin };
        const userRange = { start: userStartMin, end: userEndMin };
        return Math.max(ruleRange.start, userRange.start) < Math.min(ruleRange.end, userRange.end);
    }
}

/**
 * Calculates what percentage of the user's time range allows parking.
 * Takes into account time limits (e.g., 2hr limit means you can park for up to 2 hours).
 * Returns 1.0 if you can park for the entire requested duration.
 * Returns partial value if you can only park for part of the time.
 * Returns 0 if you cannot park at all.
 * @param {object} props The feature properties.
 * @param {Date} start The start of the user's range.
 * @param {Date} end The end of the user's range.
 * @returns {number} Parking availability ratio from 0 to 1.
 */
export function calculateCoverage(props, start, end) {
    const activeDays = parseDays(props.days);
    const regTime = parseTimeRange(props.hours);
    const dayOfWeek = start.getDay();
    const regulation = (props.regulation || '').toLowerCase();

    const userStartMin = start.getHours() * 60 + start.getMinutes();
    const userEndMin = end.getHours() * 60 + end.getMinutes();
    const userDurationMin = userEndMin - userStartMin;

    if (userDurationMin <= 0) return 0;

    // Check if regulation applies today
    const regulationAppliesToday = !activeDays || activeDays.has(dayOfWeek);

    // If regulation doesn't apply today, entire range is free
    if (!regulationAppliesToday) {
        return 1.0;
    }

    // Determine if this is a "no parking" regulation
    const isNoParking = /no\s*parking|tow-?away/.test(regulation);

    // Calculate overlap between user's range and regulation time
    let overlapMinutes = 0;

    if (!regTime) {
        // No time restriction means regulation applies 24/7
        overlapMinutes = userDurationMin;
    } else if (regTime.startMin === 0 && regTime.endMin === 1440) {
        // ANYTIME or 24HR
        overlapMinutes = userDurationMin;
    } else if (regTime.endMin <= regTime.startMin) {
        // Regulation is overnight
        const ruleRange1 = { start: regTime.startMin, end: 1440 };
        const ruleRange2 = { start: 0, end: regTime.endMin };
        const userRange = { start: userStartMin, end: userEndMin };

        const overlap1Start = Math.max(ruleRange1.start, userRange.start);
        const overlap1End = Math.min(ruleRange1.end, userRange.end);
        if (overlap1Start < overlap1End) {
            overlapMinutes += overlap1End - overlap1Start;
        }

        const overlap2Start = Math.max(ruleRange2.start, userRange.start);
        const overlap2End = Math.min(ruleRange2.end, userRange.end);
        if (overlap2Start < overlap2End) {
            overlapMinutes += overlap2End - overlap2Start;
        }
    } else {
        // Regulation is same-day
        const overlapStart = Math.max(regTime.startMin, userStartMin);
        const overlapEnd = Math.min(regTime.endMin, userEndMin);
        if (overlapStart < overlapEnd) {
            overlapMinutes = overlapEnd - overlapStart;
        }
    }

    // If no overlap with regulation hours, you can park freely
    if (overlapMinutes === 0) {
        return 1.0;
    }

    // If "No Parking" regulation overlaps, you cannot park during that time
    if (isNoParking) {
        const freeMinutes = userDurationMin - overlapMinutes;
        return freeMinutes / userDurationMin;
    }

    // Check for time limit (e.g., "2" means 2 hour limit)
    const timeLimit = props.hrlimit || props.hours;
    let timeLimitMinutes = null;

    if (timeLimit && typeof timeLimit === 'string') {
        const limitMatch = timeLimit.match(/(\d+)/);
        if (limitMatch) {
            timeLimitMinutes = parseInt(limitMatch[1], 10) * 60;
        }
    } else if (typeof timeLimit === 'number') {
        timeLimitMinutes = timeLimit * 60;
    }

    // If there's a time limit and user duration exceeds it during regulated hours
    if (timeLimitMinutes && overlapMinutes > 0) {
        // You can park for up to timeLimitMinutes within the regulated period
        const allowedMinutes = Math.min(timeLimitMinutes, overlapMinutes);
        const freeMinutes = (userDurationMin - overlapMinutes) + allowedMinutes;
        return Math.min(1.0, freeMinutes / userDurationMin);
    }

    // Default: if there's a regulation but no specific restriction type identified,
    // assume you can park during non-regulated hours only
    const freeMinutes = userDurationMin - overlapMinutes;
    return freeMinutes / userDurationMin;
}
