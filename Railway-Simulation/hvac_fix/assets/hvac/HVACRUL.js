/**
 * HVACRUL.js
 * ---------------------------------------------------------------
 * Computes a Remaining Useful Life estimate for the LIVE telemetry
 * stream (dashboard / real-time inference use case).
 *
 * Note: this is a *physics-based estimate*, not ground truth --
 * a live simulator can't know the future. It projects forward from
 * the current wear rate: "at this rate of wear, how many more hours
 * until compressorWear reaches 1.0?"
 *
 * For ML TRAINING DATA, use generateTrainingDataset.js instead, which
 * runs each unit all the way to actual failure and back-labels the
 * TRUE remaining time at every row (like NASA's CMAPSS dataset).
 * That is the correct label to train on. This live estimate is only
 * for showing a number on the dashboard while the sim is running.
 */
class HVACRUL {

    /**
     * @param wearState     { compressorWear, designLifeHours } from HVACDegradation
     * @param recentWearRatePerHour  smoothed wear rate (see SimulationEngine)
     */
    static estimate(wearState, recentWearRatePerHour) {
        const remainingWearBudget = 1 - wearState.compressorWear;

        if (recentWearRatePerHour <= 1e-9) {
            // No measurable wear yet (unit brand new / idle) -- fall back to design life
            return Math.round(wearState.designLifeHours);
        }

        const hours = remainingWearBudget / recentWearRatePerHour;
        return Math.round(Math.max(0, Math.min(hours, wearState.designLifeHours * 1.5)));
    }
}

module.exports = HVACRUL;
