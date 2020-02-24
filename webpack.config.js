const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
      background: './src/background.js',
      content: './src/content.js',
      api: './src/api.js',
      popup: './src/popup.js',
      options: './src/options.js'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|gif)$/i,
        loader: 'file-loader',
        options: {
          name: '[path][name].[ext]',
        },
      },
    ],
  },
  plugins: [
    new CopyPlugin([
      { from: './src/*.+(html|png|json|css|svg)', 
        to: path.resolve(__dirname, 'dist'),
        flatten:true
    },
    { from: './src/components/*.+(html|png|json|css|svg)', 
    to: path.resolve(__dirname, 'dist/components'),
    flatten:true
}
      
    ]),
  ]
};