const TerserPlugin = require("terser-webpack-plugin");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")

module.exports = (env) => ({
    entry: ["./src/index.js"],
    output: {
        path: __dirname + "/dist",
        filename: "index.js",
        library: {
            name: "mangaRightSource",
            type: "umd"
        },
        globalObject: "this",
    },
    module: {
        rules: [
            {
                test: /\.(js|mjs|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader"
                }
            }
        ]
    },
    optimization: {
        usedExports: true,
        minimize: env.producion === true,
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    format: {
                        comments: false,
                    },
                },
                extractComments: false,
            }),
        ],
    },
    plugins: [
        new NodePolyfillPlugin()
    ],
    resolve: {
        fallback: {
            url: require.resolve("url"),
            fs: require.resolve("fs"),
            assert: require.resolve("assert"),
            crypto: require.resolve("crypto-browserify"),
            http: require.resolve("stream-http"),
            https: require.resolve("https-browserify"),
            os: require.resolve("os-browserify/browser"),
            buffer: require.resolve("buffer"),
            stream: require.resolve("stream-browserify"),
        },
    }
});
