class AssetManager {

    constructor() {
        this.assets = [];
    }

    registerAsset(asset) {
        this.assets.push(asset);
    }

    getAssets() {
        return this.assets;
    }

}

module.exports = AssetManager;