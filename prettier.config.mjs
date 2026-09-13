/** @type {import("prettier").Config & import("prettier-plugin-tailwindcss").PluginOptions} */
const config = {
	useTabs: true,
	tabWidth: 2,
	printWidth: 100,
	semi: true,
	singleQuote: false,
	trailingComma: "es5",
	plugins: ["prettier-plugin-tailwindcss"],
	// Sorts Tailwind classes in className and in these helpers.
	tailwindStylesheet: "./app/globals.css",
	tailwindFunctions: ["cn", "cva"],
	overrides: [
		{
			// Markdown and YAML are indented with spaces.
			files: ["*.md", "*.yml", "*.yaml"],
			options: { useTabs: false },
		},
	],
};

export default config;
