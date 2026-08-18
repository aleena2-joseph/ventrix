/**
 * HVACDegradation.js
 * ---------------------------------------------------------------
 * THE MISSING PIECE.
 *
 * The original codebase tracked `operatingHours` in EnvironmentModel
 * but nothing ever consumed it. assetState (compressorEfficiency,
 * refrigerantCharge, airflowEfficiency, motorEfficiency,
 * currentFilterRestriction) never changed, so the unit never aged
 * and health never trended toward failure -- meaning there was no
 * physical basis for a Remaining Useful Life label.
 *
 * This module is the aging engine: every tick, it nudges assetState
 * toward failure based on (a) elapsed operating hours and (b) how
 * hard the compressor is being worked (compressorLoad = stress).
 * Higher stress -> faster wear, exactly like a real machine.
 */
class HVACDegradation {

    constructor(designLifeHours = 20000) {
        // Randomized +/-15% so a fleet of simulated units has varied
        // lifespans -- critical for training data diversity (see notes).
        this.designLifeHours = designLifeHours * (0.85 + Math.random() * 0.3);

        // Wear rates are calibrated so that, under AVERAGE stress
        // (compressorLoad ~= 1.0), the unit reaches full wear at
        // approximately designLifeHours.
        this.compressorWearRatePerHour = 1 / this.designLifeHours;
        this.filterFoulingRatePerHour = 1 / (this.designLifeHours * 0.9); // filters foul faster than compressor wears
        this.motorWearRatePerHour = 1 / (this.designLifeHours * 1.3);

        this.compressorWear = 0;   // 0 = new, 1 = fully worn
        this.motorWear = 0;
        this.refrigerantLeakActive = false;
        this.refrigerantLeakRatePerHour = 0;
    }

    /**
     * @param deltaHours   hours elapsed since last tick
     * @param compressorLoad  0..1.2, from HVACPhysics -- how hard the unit is working
     * @param assetState   mutable assetState object from HVACPhysics (modified in place)
     */
    update(deltaHours, compressorLoad, assetState) {
        const stress = 0.4 + Math.max(0, compressorLoad); // idle units still wear slowly

        // --- Compressor wear -> compressorEfficiency ---
        this.compressorWear = Math.min(1, this.compressorWear + this.compressorWearRatePerHour * stress * deltaHours);
        assetState.compressorEfficiency = Math.max(0.15, 1 - this.compressorWear);

        // --- Filter fouling -> targetFilterRestriction (this line was NEVER
        //     set anywhere in the original code, so filters never clogged) ---
        const currentTarget = assetState.targetFilterRestriction || 0;
        assetState.targetFilterRestriction = Math.min(1, currentTarget + this.filterFoulingRatePerHour * stress * deltaHours);

        // --- Motor wear -> motorEfficiency + airflowEfficiency ---
        this.motorWear = Math.min(1, this.motorWear + this.motorWearRatePerHour * stress * deltaHours);
        assetState.motorEfficiency = Math.max(0.5, 1 - this.motorWear * 0.5);
        assetState.airflowEfficiency = Math.max(0.5, 1 - this.motorWear * 0.4);

        // --- Refrigerant leak (only active once triggered by a fault event) ---
        if (this.refrigerantLeakActive) {
            assetState.refrigerantCharge = Math.max(0, assetState.refrigerantCharge - this.refrigerantLeakRatePerHour * deltaHours);
        }
    }

    /** Called by EventRules when a refrigerant_leak fault fires. */
    triggerRefrigerantLeak(ratePerHour = 0.02) {
        this.refrigerantLeakActive = true;
        this.refrigerantLeakRatePerHour = ratePerHour;
    }

    /** Called by EventRules when a maintenance/filter-replacement event fires. */
    resetFilter(assetState) {
        assetState.targetFilterRestriction = 0;
        assetState.currentFilterRestriction = 0;
    }

    getWearState() {
        return {
            compressorWear: Number(this.compressorWear.toFixed(4)),
            motorWear: Number(this.motorWear.toFixed(4)),
            designLifeHours: Math.round(this.designLifeHours),
        };
    }
}

module.exports = HVACDegradation;
