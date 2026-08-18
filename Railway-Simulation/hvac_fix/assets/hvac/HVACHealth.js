class HVACHealth {

    normalizeHigherIsWorse(value, normal, failure) {

        if (value <= normal) return 100;
        if (value >= failure) return 0;

        return (
            100 -
            ((value - normal) / (failure - normal)) * 100
        );
    }

    normalizeLowerIsWorse(value, normal, failure) {

        if (value >= normal) return 100;
        if (value <= failure) return 0;

        return (
            ((value - failure) / (normal - failure)) * 100
        );
    }

    calculateHealth(telemetry) {

        const filterHealth =
            this.normalizeHigherIsWorse(
                telemetry.filterDP,
                120,
                320
            );

        const compressorHealth =
            this.normalizeHigherIsWorse(
                telemetry.compressorCurrent,
                18,
                26
            );

        const temperatureHealth =
            this.normalizeHigherIsWorse(
                telemetry.supplyAirTemperature,
                18,
                28
            );

        const coolingHealth =
            this.normalizeLowerIsWorse(
                telemetry.coolingCapacity,
                35,
                20
            );

        const healthScore = Math.round(

            filterHealth * 0.35 +

            compressorHealth * 0.25 +

            coolingHealth * 0.25 +

            temperatureHealth * 0.15

        );

        let healthStatus;

        if (healthScore >= 90)
            healthStatus = "HEALTHY";

        else if (healthScore >= 75)
            healthStatus = "GOOD";

        else if (healthScore >= 60)
            healthStatus = "WARNING";

        else if (healthScore >= 40)
            healthStatus = "MAINTENANCE_REQUIRED";

        else
            healthStatus = "CRITICAL";

        return {

            healthScore,

            healthStatus,

            sensorHealth: {

                filter: Math.round(filterHealth),

                compressor: Math.round(compressorHealth),

                cooling: Math.round(coolingHealth),

                temperature: Math.round(temperatureHealth)

            }

        };
    }
}

module.exports = HVACHealth;