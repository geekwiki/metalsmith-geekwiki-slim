#!/usr/bin/env node

const fs            = require( 'fs' )
const path          = require( 'path' )
//const _           = require( 'lodash' )
const _             = require( 'flat-line' )
const debug         = require( 'debug' )( 'build.js' )
//const postcss       = require( 'postcss' )
//const pdf           = require( 'html-pdf' )
const Metalsmith    = require( 'metalsmith' )
//const xml2json      = require( 'xml2json' )
const gracefulFs    = require( 'graceful-fs' )
//const mapSiteJson   = require( '../metalsmith-mapsite-json' )
const mapSiteJson   = require( 'metalsmith-mapsite-json' )
const JSONc         = require( 'circular-json' )
//const msGithub      = require( '../metalsmith-github' )
const webpack       = require( 'webpack' )

//const NyanProgressPlugin = require( './webpack-progress-plugin' )
//const NyanProgressPlugin = require( 'webpack-progress-plugin' )


gracefulFs.gracefulify(fs)

//const metadata    = require( '../metalsmith-metadata' )

//const dataUtil = require( './metalsmith-data-util' )
// Metalsmith plugin names to load (names of npm packages without /^metalsmith-/)

// For maximum lazyness - manage all metalsmith plugins in an array, then iterate over each to require
const msPlugins = [
  'assets',
  'build-date',
  'collections',
  'drafts',
  'each',
  'filenames',
  'in-place',
  'include',
  'layouts',
  'mapsite-json',
  'markdown',
  'markdownit',
  'metadata-directory',
  'pug',
  'paths',
  'redirect',
  'static',
  'webpack',
  'writemetadata',

  /*
  'feed-atom',
  'metadata',
  'alias',
  'dynamic',
  'permalinks',
  'default-values',
  'fingerprint',
  'mapsite'
  */
]

const ms = {}

_.forEach( msPlugins, value => {
  let _plugin = `metalsmith-${value}`

  try {
    ms[ value ] = require( _plugin )

    debug( `[${Object.keys(ms).length}/${msPlugins.length}] Successfully loaded metalsmith plugin ${_plugin}` )
  }
  catch( err ) {
    debug( `[${Object.keys(ms).length}/${msPlugins.length}] Failed to load the metalsmith plugin ${_plugin}` )

    console.error('Exception Details:', err)

    process.exit(1);
  }
  
})

console.log('ms:', ms)

console.log("Object.keys(ms[ 'pug' ]),", Object.keys(ms[ 'pug' ]))
console.log("typeof ms[ 'pug' ],", typeof ms[ 'pug' ])

debug( `Loaded ${Object.keys(ms).length} of ${msPlugins.length} plugins specified` )

const _internal = {
  absPath: function( ){
    var args = Array.from( arguments )

    args.unshift( __dirname )

    return path.resolve.apply( this, args )
  }
}

/**
 * Read a specified XML file, return its contents in JSON format
 *
 * @note This will be easily replaced by https://github.com/geekwiki/metalsmith-data-util 
 */
function xmlFile2json( filePath ){
  const _d      = require( 'debug' )( 'xmlFile2json' )
  const parser  = require( 'xml2json' )
  const fs      = require( 'fs' )

  _d( 'xmlFile2json called with filename: %s', filePath )

  return function( files, metalsmith, done ){

     fs.readFile( filePath, 'utf8', function ( err, data ) {
      if ( err ){
        _d( 'ERROR: %s', err )
        return done( err )
      }
      
      var json = parser.toJson( data )
      _d( 'RESULT: %s', json )

      return done( null, json )
    })
  }
}

function yaml2json( folder ){
  const _d      = require( 'debug' )( 'xmlFile2json' )
  const parser  = require( 'xml2json' )
  const fs      = require( 'fs' )

  _d( 'xmlFile2json called with filename: %s', filePath )

  return function( files, metalsmith, done ){

     fs.readFile( filePath, 'utf8', function ( err, data ) {
      if ( err ){
        _d( 'ERROR: %s', err )
        return done( err )
      }
      
      var json = parser.toJson( data )
      _d( 'RESULT: %s', json )

      return done( null, json )
    })
  }
}

Metalsmith.prototype.msUse = function( name, opts ){
  if ( ! name || typeof name !== 'string' ){
    throw new Error( 'Invalid plugin name' ) 
  }

  let toExec

  if ( Object.keys( ms ).indexOf( name ) === -1 ){
    console.log('>>>> CHECKPOINT B:', name)
    debug( 'The plugin name "%s" was not found in the msPlugins array - skipping', name )

    return this.use( (function plugin(opts) {
      return function (files, metalsmith, done) {
        done()
      }
    })())
  }

  debug( 'Successfully found plugin "%s" in the msPlugins array - loading', name )

  return this.use( ms[ name ]( opts ) )
}

const config = require( './config' )


/* Metalsmith
 ******************************************************************************/

const siteBuild = Metalsmith(__dirname)
  .source( config.source )
  .destination( config.buildPath )
  .clean(true)
  /*
  .use('mapsite',{
    "hostname": "http://geekwiki.local/"
  })
  */
  // .use( ms[ '' ]() )
  .use( ms[ 'drafts' ]() )
  .use( ms[ 'filenames' ]() )
  .use( ms[ 'paths' ]({
    property: 'paths'
  }))
  .use( ms[ 'pug' ]({
    pretty: false,
    locals: {
      postName: 'good post name'
    }
  }))
  .use( ms[ 'webpack' ]({
    context: _internal.absPath( './assets/js/' ),
    entry: './index.js',
    stats: {
      colors: true
    },
    output: {
      path: _internal.absPath( './public/assets/js/' ),
      filename: 'bundle.js'
    },
    plugins: [
      //new NyanProgressPlugin(),
      new webpack.optimize.UglifyJsPlugin({
        beautify  : true,
        comments  : true,
        mangle    : true,
        compress  : { 
          warnings    : false,
          dead_code   : true,
          cascade     : true,
          global_defs : {
              DEBUG: true
          }
        }
      }),
      function() {
        this.plugin("done", function(stats) {
          console.log( 'Start Time: %s', new Date( stats.startTime ).toString() )
          console.log( 'End Time: %s', new Date( stats.endTime ).toString() )
          console.log( 'Elapsed Time: %s', stats.endTime - stats.startTime)

          /*require("fs").writeFileSync(
            path.join(__dirname, "..", "stats.json"),
            JSON.stringify(stats.toJson()));*/
        });
      }
      /*new require('webpack').ProgressPlugin(function handler(percentage, msg) {
        console.log( 'Webpack Progress - percentage:', percentage)
        console.log( 'Webpack Progress - msg:', msg)
      })*/
    ]
  }))
  .use( ms[ 'metadata-directory' ]({
    directory: 'metadata/*.json'
  }) )
  .use( ms[ 'assets' ]({
    source      : './assets', 
    destination : './assets' 
  }) )
  .use( ms[ 'collections' ]({
    articles: 'articles/*.md'
    /*articles2: {
      pattern: 'articles/*.md'
    }*/
  }) )
  .use( ms[ 'in-place' ]({
    //engine  : ms[ 'pug' ],
    pretty  : config.usePretty,
    pattern : '*.md'
  }) )
  .use( ms[ 'include' ]() )
  .use( ms[ 'markdown' ]() )
  .use( ms[ 'markdownit' ]({
    html        : true,
    xhtmlOut    : true,
    typographer : true,
    linkify     : true
  }) )
  .use( ms[ 'static' ]({
    src   : 'source/data',
    dest  : 'data'
  }) )
  .use( ms[ 'layouts' ]({
    //engine  : ms[ 'pug' ],
    engine    : 'pug',
    pretty    : config.usePretty,
    directory : 'templates/',
    pattern   : [
      '**', 
      '!json-data/*',
      // Skip over the partials that were already processed
      '!partials/*',  '!partials/*/*'
    ]
  }) )
  .use( ms[ 'writemetadata' ]({
    collections: {
      articles: {
        output: {
          path: 'articles/index.json',
          asObject: true,
          metadata: {
            "type": "list"
          }
        },
       ignorekeys: ['next', 'previous','contents']
      }
    }
  }))
  //.use( ms[ '' ]() )
  .build( err => {
    if (err) {
      console.log('Error:',err)
    } 
    else {
      console.log('Metalsmith complete!\n')

       //stylesheets()
       print()
    }
  })

/* PostCSS
 ******************************************************************************/

function stylesheets () {
  var css = fs.readFileSync('css/main.css', 'utf-8')

  var plugins = [
    require( 'postcss-import'),
    require( 'postcss-nested'),
    require( 'postcss-custom-properties'),
    require( 'postcss-custom-media'),
    require( 'postcss-color-function'),
    require( 'postcss-focus'),
    require( 'autoprefixer')({
      browsers: ['last 2 versions', '> 5%']
    }),
    require( 'css-mqpacker'),
    require( 'cssnano')
  ]

  if (process.env.NODE_ENV === 'production') {
    plugins.push(
      require( 'postcss-uncss')({
        html: ['public/**/*.html']
      })
    )
  }

  postcss(plugins)
    .process(css, {
      from: 'css/main.css',
      to: 'public/css/main.css',
      map: { inline: false }
    })
    .then(function (result) {
      if (result.warnings()) {
        result.warnings().forEach(warn => {
          console.warn(warn.toString())
        })
      }
      fs.mkdirSync('public/css')
      fs.writeFileSync('public/css/main.css', result.css, 'utf-8')
      if (result.map) fs.writeFileSync('public/css/main.css.map', result.map, 'utf-8')
      console.log('PostCSS Complete!\n')
    })
}

/* PDF
 ******************************************************************************/

function print () {
  return
  var html = fs.readFileSync( config.buildPath + '/' + config.resumePdf.source, 'utf8' )

  var options = {
    height: '11in',
    width: '8.5in',
    type: 'pdf',
    base: 'http://localhost:8008'
  }


  /*
  var server = require( 'browser-sync' ).create()
  server.init({
    server: 'public',
    port: 8008,
    open: false,
    ui: false
  })
  */

  pdf.create(html, options).toFile( config.resumePdf.dest, function (err, res) {
    if (err) return console.log(err)
    console.log('\nPDF generation complete!\n')
    console.log('PDF generated from HTML page %s to document %s', config.resumePdf.source, config.resumePdf.dest)
    //process.exit()
  })
}


