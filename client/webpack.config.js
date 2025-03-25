const path = require('path');

module.exports = {
    mode: 'development',
    entry: './src/index.js', // Укажите путь к вашему основному файлу
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
        publicPath: '/',
    },
    devServer: {
        contentBase: path.join(__dirname, 'dist'),
        compress: true,
        port: 3001,
        allowedHosts: ['localhost', '127.0.0.1', '0.0.0.0'], // Добавьте разрешенные хосты
        historyApiFallback: true,
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader', // Убедитесь, что у вас установлен babel-loader
                    options: {
                        presets: ['@babel/preset-env', '@babel/preset-react'],
                    },
                },
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
};
