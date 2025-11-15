"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebpageExportInstance = exports.ExportFile = void 0;
const target_base_1 = require("@rnbo/target-base");
const path_1 = require("path");
const fs_1 = require("fs");
const { mkdir, writeFile, unlink } = fs_1.promises;
const validation_1 = require("./validation");
const icon_1 = require("./icon");
const util_1 = require("./util");
;
var ExportFile;
(function (ExportFile) {
    ExportFile[ExportFile["HTML"] = 0] = "HTML";
    ExportFile[ExportFile["Patch"] = 1] = "Patch";
})(ExportFile = exports.ExportFile || (exports.ExportFile = {}));
class WebpageExportInstance extends target_base_1.TargetInstance {
    static configTemplate = [
        {
            name: "output_path",
            type: target_base_1.ConfigurationFieldType.CONFIG_FIELDTYPE_FOLDER,
            label: "Output Directory",
            default: "",
            description: "Folder into which the exported patcher and associated files will be saved.",
            saved: target_base_1.TargetConfigFieldSaveScope.TARGETCONFIGFIELDSAVESCOPE_USER
        },
        {
            name: "include_ui",
            type: target_base_1.ConfigurationFieldType.CONFIG_FIELDTYPE_BOOLEAN,
            label: "Include Generic UI Library",
            default: true,
            description: "Enable to include a basic user interface, consisting of simple sliders for params and a mouse-activated keyboard.",
            saved: target_base_1.TargetConfigFieldSaveScope.TARGETCONFIGFIELDSAVESCOPE_GLOBAL
        },
        {
            name: "include_devtools",
            type: target_base_1.ConfigurationFieldType.CONFIG_FIELDTYPE_BOOLEAN,
            label: "Include Dev Utilities",
            default: true,
            saved: target_base_1.TargetConfigFieldSaveScope.TARGETCONFIGFIELDSAVESCOPE_GLOBAL
        },
        {
            name: "copy_dependencies",
            type: target_base_1.ConfigurationFieldType.CONFIG_FIELDTYPE_BOOLEAN,
            label: "Copy Sample Dependencies",
            default: false,
            description: "When enabled, RNBO will collect and copy any sample dependencies to the output folder. This will also change the paths in samples.json to be output-local paths.",
            saved: target_base_1.TargetConfigFieldSaveScope.TARGETCONFIGFIELDSAVESCOPE_GLOBAL
        },
        // Codegen Params
        Object.assign({}, target_base_1.codegenConfigTemplate.classname, { hidden: true, default: "rnbomatic" }),
        Object.assign({}, target_base_1.codegenConfigTemplate.debug, { default: false }),
        Object.assign({}, target_base_1.codegenConfigTemplate.language, { hidden: true, default: target_base_1.CodegenLanguage.CODEGEN_LANGUAGE_CPP }),
        Object.assign({}, target_base_1.codegenConfigTemplate.midi, { default: true }),
        Object.assign({}, target_base_1.codegenConfigTemplate.polyphony, { default: target_base_1.PolyphonyCodegenConfig.linked }),
        Object.assign({}, target_base_1.codegenConfigTemplate.exposevoiceparams, { default: false }),
        Object.assign({}, target_base_1.codegenConfigTemplate.probing, { default: false, hidden: true }),
        Object.assign({}, target_base_1.codegenConfigTemplate.fixedblocksize, { default: undefined }),
        Object.assign({}, target_base_1.codegenConfigTemplate.staterestore, { default: false }),
        Object.assign({}, target_base_1.codegenConfigTemplate.presets, { default: true }),
        Object.assign({}, target_base_1.codegenConfigTemplate.uimessages, { hidden: false })
    ];
    static filenames = {
        [ExportFile.HTML]: "index.html",
        [ExportFile.Patch]: "patch.export.json"
    };
    static filePathToWebPath(p) {
        return p.split(path_1.sep).join("/");
    }
    constructor(id) {
        super({ id });
        this.setIconData(icon_1.XmlIcon);
        this.setRefpage("https://rnbo.cycling74.com/learn/the-web-export-target");
    }
    async getConfigurationTemplate() {
        return this.constructor.configTemplate;
    }
    get category() {
        return target_base_1.TargetCategory.TARGET_CATEGORY_PRODUCT;
    }
    get name() {
        return "Static Webpage Export";
    }
    get configTemplate() {
        return WebpageExportInstance.configTemplate;
    }
    getCDNBaseURL() {
        return `https://c74-public.nyc3.digitaloceanspaces.com/rnbo/${encodeURIComponent(this.rnboVersion)}`;
    }
    async validateConfigField(field, value, config) {
        await (0, validation_1.validateConfigField)(field, value, config);
    }
    getHtmlTemplate(config) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
	<meta name="theme-color" content="#000000">
	<meta name="rnbo-version" content="${this.rnboVersion}">
	<title>RNBO Webexport</title>

	<style>
		html, body {
			margin: 0;
			padding: 0;
		}

		#rnbo-root {
			height: 100vh;
			width: 100vw;
		}
	</style>
</head>

<body>
	<noscript>You need to enable JavaScript to run this app.</noscript>
	<div id="rnbo-root"></div>

	<!-- Import RNBO Engine Wrapper -->
	<script type="text/javascript" src="${this.getCDNBaseURL()}/rnbo.min.js"></script>

	${!config.include_ui ? "" : `
	<!-- Import RNBO UI -->
	<script type="text/javascript" src="${this.getCDNBaseURL()}/rnboui.min.js"></script>`}
	${!config.include_devtools ? "" : `
	<!-- Import RNBO DevTools -->
	<script type="text/javascript" src="${this.getCDNBaseURL()}/rnbodev.min.js"></script>`}

	<script>
		// Create AudioContext
		var WAContext = window.AudioContext || window.webkitAudioContext;
		var context = new WAContext();

		// Create gain node and connect it to audio output
		var outputNode = context.createGain();
		outputNode.connect(context.destination);

		var patcher;
		var presets = [];
		var samples = [];

		fetch("${WebpageExportInstance.filePathToWebPath(WebpageExportInstance.filenames[ExportFile.Patch])}")
			.then((response) => response.json())

			.then((responseJson) => {
				patcher = responseJson;
			})

			// Use the fetched patcher to create a RNBO device
			.then(() => {
				presets = patcher.presets ? patcher.presets : [];
				return RNBO.createDevice({
					context,
					patcher
				});
			})

			.then((device) => {

				// When the device is ready, connect it to audio output
				device.node.connect(outputNode);

				${!config.include_ui ? "" :
            `// RNBOUI Setup
				// Create a renderer to display the device layout
				var deviceUI = RNBOUI.createRenderer(
					device,
					patcher,
					document.getElementById("rnbo-root"), // the DOMElement that holds our RNBO UI,
					{
						showEnableOverlay: true
					}
				);
				`}

				${!config.include_devtools ? "" : `
				// DevTools Setup
				var devGui = new RNBODev.GUI({ device, outputNode, presets });
				`}
				return device;
			})
			.then(async (device) => {
				// (Optional) load dependencies
				let dependencies = undefined;
				try {
					const rawResponse = await fetch("dependencies.json");
					dependencies = await rawResponse.json();
				} finally {
					return device.loadDataBufferDependencies(dependencies);
				}
			})
			.catch((err) => {
				console.error(err)
			});
	</script>
</body>
</html>
		`.trim();
    }
    async handleCodegenOutput(config, result, payload) {
        const context = this.getExportInvocationContext();
        const dir = config.output_path;
        const mediaDir = (0, path_1.join)(dir, target_base_1.TargetExportFolders.Media);
        let datarefDependencies = payload.datarefDependencies || [];
        // Ensure output dir
        if (!(0, fs_1.existsSync)(dir))
            await mkdir(dir, { recursive: true });
        // Copy sample dependencies (this modifies the output paths for sample dependencies)
        if (config.copy_dependencies && datarefDependencies) {
            context.reportExportProgress(30, "Copying sample dependencies");
            datarefDependencies = await (0, target_base_1.copyDatarefDependencies)(datarefDependencies, mediaDir);
            const formattedDependencies = (0, target_base_1.formatDependenciesForExport)(datarefDependencies, dir);
            await writeFile((0, path_1.join)(dir, this.bufferDependenciesFilename), JSON.stringify(formattedDependencies, null, 2), "utf8");
        }
        // Write HTML with relevant components
        context.reportExportProgress(40, "Writing index.html file");
        // Ask if you should delete this file first
        const htmlPath = (0, path_1.join)(dir, WebpageExportInstance.filenames[ExportFile.HTML]);
        let overwriteHtml = true;
        let htmlExists = (0, fs_1.existsSync)(htmlPath);
        if (htmlExists) {
            if (context) {
                const dialogResult = await context.requestDialog({
                    message: `Static webpage export`,
                    detail: `index.html file exists. Overwrite?`
                });
                overwriteHtml = dialogResult.buttonIndex === 1;
            }
        }
        if (overwriteHtml) {
            if (htmlExists)
                await unlink(htmlPath);
            await writeFile(htmlPath, this.getHtmlTemplate(config), { encoding: "utf8" });
        }
        // Write generated patch
        context.reportExportProgress(80, "Writing generated patch");
        // const exportDescPath = join(dir, WebpageExportInstance.filenames[ExportFile.Package]);
        const exportFilePath = (0, path_1.join)(dir, WebpageExportInstance.filenames[ExportFile.Patch]);
        if ((0, fs_1.existsSync)(exportFilePath))
            await unlink(exportFilePath);
        const bundle = await (0, util_1.createWASMExportBundle)(result, payload, { debug: config.debug });
        await writeFile(exportFilePath, JSON.stringify(bundle), "utf8");
        return {
            actions: [
                { type: target_base_1.TargetExportActionType.EXPORT_ACTION_OPENFILE, payload: { path: config.output_path } }
            ]
        };
    }
}
exports.WebpageExportInstance = WebpageExportInstance;
//# sourceMappingURL=webpage.js.map