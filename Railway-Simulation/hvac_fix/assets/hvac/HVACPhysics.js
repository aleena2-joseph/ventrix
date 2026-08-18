const HVACDegradation = require("./HVACDegradation");
const HVACRUL = require("./HVACRUL");

class HVACPhysics {
    constructor(designLifeHours = 20000) {
        this.degradation = new HVACDegradation(designLifeHours);
        this.lastOperatingHours = 0;
        this.wearRateHistory = []; // for smoothing the live RUL estimate

        this.telemetry = {
            // Thermal Performance
            coolingCapacity: 35,          // kW
            supplyAirTemperature: 18,     // °C
            // Compressor
            compressorCurrent: 18,        // A
            refrigerantPressure: 8.0,     // bar
            // Airflow
            filterDP: 120,                // Pa
            // Electrical
            powerConsumption: 12.5,        // kW

            // Degradation / RUL (NEW -- these were missing entirely before)
            compressorWear: 0,             // 0..1
            motorWear: 0,                  // 0..1
            refrigerantCharge: 1.0,        // 1..0
            operatingHours: 0,
            remainingUsefulLife: 20000     // hours -- THE ML TRAINING LABEL
        };
        this.constants = {

            // Cabin Conditions
             BASE_CABIN_TEMPERATURE: 24,

            // Airflow Model
             NOMINAL_AIRFLOW: 1.0,          // Normalized (100%)
             MAX_FILTER_DP: 500,            // Pa
             NOMINAL_FILTER_DP: 120,         // Pa
             MIN_AIRFLOW: 0.35,            // Never below 35%  

            // Heat Load Constants
            HEAT_PER_PASSENGER: 0.12,      
            AMBIENT_HEAT_FACTOR: 0.8,
            DOOR_HEAT_FACTOR: 0.08,
            EQUIPMENT_HEAT_LOAD: 2.5,
            HVAC_COP: 3.2,             
            NOMINAL_COOLING_CAPACITY: 35,
            POWER_FACTOR: 0.90,
            MOTOR_EFFICIENCY: 0.93,
            NOMINAL_REFRIGERANT_PRESSURE: 8.0,   // bar
            MIN_REFRIGERANT_PRESSURE: 5.5,       // bar
            MAX_REFRIGERANT_PRESSURE: 11.0,
            SUPPLY_AIR_SETPOINT: 18,      
            RETURN_AIR_NOMINAL: 24        
        };

        this.assetState = {

            // Filter condition
            targetFilterRestriction: 0,
            currentFilterRestriction: 0,

            // Refrigerant health
            refrigerantCharge: 1.0,

            // Compressor condition
            compressorEfficiency: 1.0,

            // Fan condition
            airflowEfficiency: 1.0,

            // Electrical condition
            motorEfficiency: 1.0
        };

        this.systemState = {

            heatLoad: 0,
            coolingDemand: 0,

            // Airflow Model
            filterDP: 0,
            airflow: 0,

            coolingCapacity: 0,
            compressorLoad: 0,
            electricalPower: 0,
            compressorCurrent: 0,
            refrigerantPressure: 0,
            supplyAirTemperature: 0
        };
    }

    round(value) {
        return Number(value.toFixed(2));
    }

    resetAssetState() {

    this.assetState = {

        // Filter condition
        targetFilterRestriction: 0,
        currentFilterRestriction: 0,


        // Refrigerant health
        refrigerantCharge: 1.0,

        // Compressor condition
        compressorEfficiency: 1.0,

        // Fan condition
        airflowEfficiency: 1.0,
        
        // Electrical condition
        motorEfficiency: 1.0

    };

}

    calculateAmbientHeat(environment) {

    const BASE_TEMPERATURE =
    this.constants.BASE_CABIN_TEMPERATURE;

    return Math.max(
        0,
        (environment.ambientTemperature - BASE_TEMPERATURE) * this.constants.AMBIENT_HEAT_FACTOR
    );

}

    calculatePassengerHeat(environment) {

    const HEAT_PER_PASSENGER =
    this.constants.HEAT_PER_PASSENGER;

    return environment.passengerCount * HEAT_PER_PASSENGER;

}

    calculateDoorHeat(environment) {

    return environment.doorOpenPercentage * this.constants.DOOR_HEAT_FACTOR

}
    calculateEquipmentHeat() {

    return this.constants.EQUIPMENT_HEAT_LOAD;

}
    calculateHeatLoad(environment) {

    const ambient =
        this.calculateAmbientHeat(environment);

    const passenger =
        this.calculatePassengerHeat(environment);

    const door =
        this.calculateDoorHeat(environment);

    const equipment =
        this.calculateEquipmentHeat();

    return (
        ambient +
        passenger +
        door +
        equipment
    );

}
    calculateFilterDP() {

    const restriction =
        this.assetState.currentFilterRestriction;

    const nominalDP =
        this.constants.NOMINAL_FILTER_DP;

    const maxDP =
        this.constants.MAX_FILTER_DP;

    return (

        nominalDP +

        (maxDP - nominalDP) * restriction

    );

}
    updateFilterRestriction() {

    const target =
        this.assetState.targetFilterRestriction;

    let current =
        this.assetState.currentFilterRestriction;

    const step = 0.02;

    if (current < target) {

        current = Math.min(
            current + step,
            target
        );

    }
    else if (current > target) {

        current = Math.max(
            current - step,
            target
        );

    }

    this.assetState.currentFilterRestriction =
        current;

}
    calculateActualAirflow() {

    const filterDP =
        this.calculateFilterDP();

    const nominalDP =
        this.constants.NOMINAL_FILTER_DP;

    const maxDP =
        this.constants.MAX_FILTER_DP;

    const nominalAirflow =
        this.constants.NOMINAL_AIRFLOW;

    const minimumAirflow =
        this.constants.MIN_AIRFLOW;

    const restrictionRatio =

        (filterDP - nominalDP) /

        (maxDP - nominalDP);

    let airflow =

        nominalAirflow -

        restrictionRatio *

        (nominalAirflow - minimumAirflow);

    airflow = Math.max(

        minimumAirflow,

        Math.min(

            airflow,

            nominalAirflow

        )

    );

    return airflow;

}

calculateCoolingDemand(environment) {

    /*
        Cooling demand is simply the amount
        of heat that must be removed.

        For now we assume all heat must be removed.

        Later we will include:

        - HVAC efficiency
        - Refrigerant degradation
        - Compressor aging
        - Filter clogging
        - Coil fouling
    */

    return this.calculateHeatLoad(environment);

}

calculateCompressorLoad(environment) {

    const coolingDemand =
        this.calculateCoolingDemand(environment);

    const coolingCapacity =
        this.calculateCoolingCapacity(environment);

    let load =

        coolingDemand /

        Math.max(coolingCapacity, 0.1);

    load = Math.min(

        Math.max(load, 0),

        1.2

    );

    return load;
}
calculatePowerConsumption() {

    const compressorLoad =
        this.systemState.compressorLoad;

    const nominalCapacity =
        this.constants.NOMINAL_COOLING_CAPACITY;

    const COP =
        this.constants.HVAC_COP;

    const ratedPower =
        nominalCapacity / COP;

    return ratedPower * compressorLoad;

}
calculateCompressorCurrent(environment) {

    const power =
        this.systemState.electricalPower;

    const voltage =
        environment.supplyVoltage;

    const powerFactor =
        this.constants.POWER_FACTOR;

    // BUG FIX: this used to reference the fixed constant
    // this.constants.MOTOR_EFFICIENCY, which meant motor wear
    // (assetState.motorEfficiency, degraded by HVACDegradation)
    // never actually affected current draw. A worn motor should
    // draw MORE current for the same output -- that's the real-world
    // overcurrent symptom this line was silently discarding.
    const efficiency =
        this.assetState.motorEfficiency;

    return (

        power * 1000

    ) / (

        Math.sqrt(3) *

        voltage *

        powerFactor *

        efficiency

    );

}
    calculateRefrigerantPressure(environment) {

    const nominalPressure =
        this.constants.NOMINAL_REFRIGERANT_PRESSURE;

    const refrigerantCharge =
        this.assetState.refrigerantCharge;

    /*
        Ambient temperature affects
        condenser pressure.

        Approximation:

        +2% pressure
        for every degree above 30°C
    */

    const ambientFactor =
        1 + ((environment.ambientTemperature - 30) * 0.02);

    let pressure =
        nominalPressure *
        refrigerantCharge *
        ambientFactor;

    pressure = Math.max(

        this.constants.MIN_REFRIGERANT_PRESSURE,

        Math.min(

            pressure,

            this.constants.MAX_REFRIGERANT_PRESSURE

        )

    );

    return pressure;

}
calculateCoolingCapacity(environment) {

    const coolingDemand =
        this.calculateCoolingDemand(environment);

    const refrigerantCharge =
        this.assetState.refrigerantCharge;

    const compressorEfficiency =
        this.assetState.compressorEfficiency;

    const airflow =
        this.calculateActualAirflow();

    const nominalCapacity =
        this.constants.NOMINAL_COOLING_CAPACITY;

    let coolingCapacity =

        coolingDemand *

        refrigerantCharge *

        compressorEfficiency *

        airflow;

    coolingCapacity = Math.min(

        coolingCapacity,

        nominalCapacity

    );

    return coolingCapacity;

}

calculateSupplyAirTemperature() {

    const coolingCapacity =
        this.systemState.coolingCapacity;

    const heatLoad =
        this.systemState.heatLoad;

    const setPoint =
        this.constants.SUPPLY_AIR_SETPOINT;

    const returnAir =
        this.constants.RETURN_AIR_NOMINAL;

    /*
        Cooling effectiveness

        1.0 = HVAC fully satisfies demand

        0.0 = No useful cooling
    */

    const effectiveness = Math.min(

        coolingCapacity /

        Math.max(heatLoad, 0.1),

        1.0

    );

    return (

        returnAir -

        effectiveness *

        (returnAir - setPoint)

    );

}
    update(environment) {
        // ==========================
        // 0. AGING (THE FIX)
        // Run the degradation engine BEFORE computing this tick's physics,
        // using the compressor load computed on the *previous* tick as the
        // stress signal (avoids a circular dependency within one tick).
        // ==========================
        const deltaHours = Math.max(0, environment.operatingHours - this.lastOperatingHours);
        const previousLoad = this.systemState.compressorLoad || 0;
        this.degradation.update(deltaHours, previousLoad, this.assetState);
        this.lastOperatingHours = environment.operatingHours;

        this.updateFilterRestriction();
        // 1
        this.systemState.heatLoad =
            this.calculateHeatLoad(environment);

        // 2
        this.systemState.coolingDemand =
            this.calculateCoolingDemand(environment);

        // 3
        this.systemState.filterDP =
            this.calculateFilterDP();

        // 4
        this.systemState.airflow =
            this.calculateActualAirflow();

        // 5
        this.systemState.coolingCapacity =
            this.calculateCoolingCapacity(environment);

        // 6
        this.systemState.compressorLoad =
            this.calculateCompressorLoad(environment);

        // 7
        this.systemState.electricalPower =
            this.calculatePowerConsumption();

        // 8
        this.systemState.compressorCurrent =
            this.calculateCompressorCurrent(environment);

        // 9
        this.systemState.refrigerantPressure =
            this.calculateRefrigerantPressure(environment);

        // 10
        this.systemState.supplyAirTemperature =
            this.calculateSupplyAirTemperature();

        // ==========================
        // Generate Telemetry
        // ==========================
        this.telemetry.coolingCapacity =
            this.round(this.systemState.coolingCapacity);

        this.telemetry.filterDP =
            this.round(this.systemState.filterDP);

        this.telemetry.powerConsumption =
            this.round(this.systemState.electricalPower);

        this.telemetry.compressorCurrent =
            this.round(this.systemState.compressorCurrent);

        this.telemetry.refrigerantPressure =
            this.round(this.systemState.refrigerantPressure);

        this.telemetry.supplyAirTemperature =
            this.round(this.systemState.supplyAirTemperature);

        // ==========================
        // Degradation / RUL telemetry (NEW)
        // ==========================
        const wearState = this.degradation.getWearState();

        // Track a smoothed compressor-wear rate (per hour) over the last
        // N ticks so the RUL estimate isn't jumpy tick-to-tick.
        if (deltaHours > 0) {
            const instantWearRate = (wearState.compressorWear - (this._prevCompressorWear ?? wearState.compressorWear)) / deltaHours;
            this.wearRateHistory.push(instantWearRate);
            if (this.wearRateHistory.length > 50) this.wearRateHistory.shift();
        }
        this._prevCompressorWear = wearState.compressorWear;
        const smoothedWearRate = this.wearRateHistory.length
            ? this.wearRateHistory.reduce((a, b) => a + b, 0) / this.wearRateHistory.length
            : 0;

        this.telemetry.compressorWear = wearState.compressorWear;
        this.telemetry.motorWear = wearState.motorWear;
        this.telemetry.refrigerantCharge = this.round(this.assetState.refrigerantCharge);
        this.telemetry.operatingHours = this.round(environment.operatingHours);
        this.telemetry.remainingUsefulLife = HVACRUL.estimate(wearState, smoothedWearRate);
    }

    getMutableAssetState() {

    return this.assetState;

}

    getAssetState() {

    return {

        ...this.assetState

    }; 

}

    getTelemetry() {

        return {
            ...this.telemetry
        };

    }
}
module.exports = HVACPhysics;