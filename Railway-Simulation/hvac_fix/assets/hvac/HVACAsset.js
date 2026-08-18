const BaseAsset = require("../common/BaseAsset");
const HVACPhysics = require("./HVACPhysics");
const HVACHealth = require("./HVACHealth");
const AssetState = require("../../state/AssetState");

class HVACAsset extends BaseAsset {

    constructor(assetId = "HVAC-001", designLifeHours = 20000) {
        super(
            assetId,
            "HVAC",
            new HVACHealth()
        );
        this.physics = new HVACPhysics(designLifeHours);
        this.refrigerantLeakTriggered = false;
    }

    /**
     * Probabilistic fault injection: a refrigerant leak can start at any
     * point, with likelihood increasing as the compressor wears. This is
     * what makes "active_fault" a genuine, physically-consequential event
     * instead of just a logged message (see EventRules.js for detection).
     */
    maybeInjectFault(deltaHours) {
        if (this.refrigerantLeakTriggered) return;
        const wear = this.physics.degradation.compressorWear;
        const hourlyProbability = 0.00002 * (1 + wear * 5);
        if (Math.random() < hourlyProbability * Math.max(deltaHours, 0.0003)) {
            this.physics.degradation.triggerRefrigerantLeak(0.015 + Math.random() * 0.02);
            this.refrigerantLeakTriggered = true;
        }
    }

    calculateTelemetry(environment) {
        const deltaHours = Math.max(0, environment.operatingHours - (this._lastHours ?? environment.operatingHours));
        this._lastHours = environment.operatingHours;
        this.maybeInjectFault(deltaHours);

        this.physics.update(environment);
        return this.physics.getTelemetry();
    }
    determineOperationalState(environment) {

    if (environment.passengerCount > 250) {
        return AssetState.HIGH_LOAD;
    }
    // Was: this.telemetry.condenserTemperature (never produced by
    // HVACPhysics -- always undefined, so HEATING could never trigger).
    if (this.telemetry.supplyAirTemperature > 25) {
        return AssetState.HEATING;
    }
    return null;
    }

}
module.exports = HVACAsset;