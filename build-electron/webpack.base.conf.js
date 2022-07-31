'use strict'
const path = require('path')
const config = require('../config-electron')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const vueLoaderConfig = require('./vue-loader.conf');

function resolve (dir) {
  return path.join(__dirname, '..', dir)
}

const rendererConfig = {
  entry: { 
    'renderer': resolve('src/main.ts'),
    'crashed': resolve('src/pages/crashed.ts'),
  },
  output: {
    filename: '[name].js',
    path: process.env.NODE_ENV === 'production' ? config.build.assetsRoot : config.dev.assetsRoot,
    publicPath: process.env.NODE_ENV === 'production' ? config.build.assetsPublicPath : config.dev.assetsPublicPath
  },
  target: 'electron-renderer',
  resolve: {
    extensions: ['.js', '.vue', '.json', '.ts'],
    alias: {
      'vue$': 'vue/dist/vue.esm.js',
      '@': resolve('src'),
      'assets': resolve('src/assets'),
      'jquery': "jquery/src/jquery",
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/
      },
      {
        test: /\.(ttf|woff|woff2|eot|otf|svg|node|bmp|png|jpg|jpeg|gif|ico)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              outputPath: 'assets',
            }
          }
        ]
      },
      { 
        test: /\.vue$/, 
        use: [
          {
            loader: 'vue-loader',
            options: vueLoaderConfig
          }
        ]
      },
      {
        test: /\.css$/, 
        use: [
          { loader: 'vue-style-loader' },
          { loader: 'css-loader' },
        ]
      },
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader:'ts-loader',
            options: {
              appendTsSuffixTo: [/\.vue$/],
            }
          }
        ],
      },
      {
        test: /\.(scss|sass)$/, use: [
          { loader: 'vue-style-loader' },
          { loader: 'css-loader' },
          { loader: 'sass-loader' },
        ]
      }
    ]
  },
  plugins: []
}
const mainConfig = {
  entry: resolve('src/main-process/main.ts'),
  output: {
    filename: 'main.js',
    path: process.env.NODE_ENV === 'production' ? config.build.assetsRoot : config.dev.assetsRoot,
    publicPath: process.env.NODE_ENV === 'production' ? config.build.assetsPublicPath : config.dev.assetsPublicPath
  },
  target: 'electron-main',
  resolve: {
    extensions: ['.js', '.vue', '.json', '.ts'],
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/
      },
      {
        test: /\.(ttf|woff|woff2|eot|otf|svg|node|bmp|png|jpg|jpeg|gif|ico)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              outputPath: 'assets',
            }
          }
        ]
      },
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader:'ts-loader',
            options: {
              appendTsSuffixTo: [/\.vue$/],
            }
          }
        ],
      },
    ]
  },
  plugins: [
    new CopyWebpackPlugin([
      {
        from: path.resolve(__dirname, '../src/main-process'),
        to: process.env.NODE_ENV === 'production' ? config.build.assetsRoot : config.dev.assetsRoot,
        ignore: [ 'main.ts' ],
      },
    ]),
    new CopyWebpackPlugin([
      {
        from: path.resolve(__dirname, '../src/assets/images/logo.ico'),
        to: (process.env.NODE_ENV === 'production' ? config.build.assetsRoot : config.dev.assetsRoot) + '/assets/logo.ico'
      },
    ])
  ]
}

module.exports = [ rendererConfig, mainConfig ]
