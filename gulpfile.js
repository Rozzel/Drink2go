import gulp from 'gulp';
import plumber from 'gulp-plumber';
import gulpIf from 'gulp-if';
import dartSass from "sass";
import gulpSass from "gulp-sass";
import postcss from 'gulp-postcss';
import postUrl from 'postcss-url';
import autoprefixer from 'autoprefixer';
import csso from 'postcss-csso';
import terser from 'gulp-terser';
import squoosh from 'gulp-libsquoosh';
import svgo from 'gulp-svgmin';
import replace from "gulp-replace";
import { stacksvg } from "gulp-stacksvg";
import { deleteAsync } from 'del';
import browser from 'browser-sync';
import bemlinter from 'gulp-html-bemlinter';
import twig from 'gulp-twig';
import { htmlValidator } from "gulp-w3c-html-validator";
import htmlmin from "gulp-htmlmin";

const date = new Date();

const sass = gulpSass(dartSass);
let isDevelopment = true;

export function processMarkup() {
  return gulp.src('source/*.html')
    .pipe(
      replace(
        "?v=cache",
        `?v=${date.getFullYear()}${date.getMonth()}${date.getDate()}${date.getHours()}${date.getMinutes()}`
      )
    )
    .pipe(twig({
      data: {
        makePicture: makePicture
      },
    }))
    .pipe(
      htmlmin({
        collapseWhitespace: true
      }))
    .pipe(gulp.dest('build'));
}

export function lintBem() {
  return gulp.src('source/*.html')
    .pipe(bemlinter());
}

export function validateMarkup() {
  return gulp.src('source/*.html')
    .pipe(htmlValidator.analyzer())
    .pipe(htmlValidator.reporter({ throwErrors: true }));
}

export function processStyles() {
  return gulp.src('source/sass/*.scss', { sourcemaps: isDevelopment })
    .pipe(plumber())
    .pipe(sass().on('error', sass.logError))
    .pipe(postcss([
      postUrl({ assetsPath: '../' }),
      autoprefixer(),
      csso()
    ]))
    .pipe(gulp.dest('build/css', { sourcemaps: isDevelopment }))
    .pipe(browser.stream());
}

export function processScripts() {
  return gulp.src('source/js/**/*.js')
    .pipe(terser())
    .pipe(gulp.dest('build/js'))
    .pipe(browser.stream());
}

export function optimizeImages() {
  return gulp.src('source/img/**/*.{png,jpg}')
    .pipe(gulpIf(!isDevelopment, squoosh()))
    .pipe(gulp.dest('build/img'))
}

export function createWebp() {
  return gulp.src('source/img/**/*.{png,jpg}')
    .pipe(squoosh({
      webp: {}
    }))
    .pipe(gulp.dest('build/img'))
}

export function optimizeVector() {
  return gulp.src(['source/img/**/*.svg', '!source/img/icons/**/*.svg'])
    .pipe(svgo())
    .pipe(gulp.dest('build/img'));
}

export function createStack() {
  return gulp.src('source/img/icons/**/*.svg')
    .pipe(svgo())
    .pipe(stacksvg())
    .pipe(gulp.dest('build/img/icons'));
}

export function copyAssets() {
  return gulp.src([
    'source/fonts/**/*.{woff2,woff}',
    'source/*.ico',
    'source/*.webmanifest',
  ], {
    base: 'source'
  })
    .pipe(gulp.dest('build'));
}

export function startServer(done) {
  browser.init({
    server: {
      baseDir: 'build'
    },
    cors: true,
    notify: false,
    ui: false,
  });
  done();
}

function reloadServer(done) {
  browser.reload();
  done();
}

function watchFiles() {
  gulp.watch('source/sass/**/*.scss', gulp.series(processStyles));
  gulp.watch('source/js/script.js', gulp.series(processScripts));
  gulp.watch('source/*.html', gulp.series(processMarkup, reloadServer));
}

function compileProject(done) {
  gulp.parallel(
    processMarkup,
    processStyles,
    processScripts,
    optimizeVector,
    createStack,
    copyAssets,
    optimizeImages,
    createWebp
  )(done);
}

function deleteBuild() {
  return deleteAsync('build');
}

export function buildProd(done) {
  isDevelopment = false;
  gulp.series(
    deleteBuild,
    compileProject
  )(done);
}

export function runDev(done) {
  gulp.series(
    deleteBuild,
    compileProject,
    startServer,
    watchFiles
  )(done);
}

const makePicture = (file, format, width, height, alt, folder, classPicture, classImg) => {
  const resultHtmlCode = `
  <picture class="${classPicture}">
    <source type="image/webp" media="(min-width: 1150px)" srcset="${folder}${file}--desktop.webp 1x, ${folder}${file}--desktop@2x.webp 2x">
    <source type="image/webp" media="(min-width: 768px)" srcset="${folder}${file}--tablet.webp 1x, ${folder}${file}--tablet@2x.webp 2x">
    <source type="image/webp" srcset="${folder}${file}--mobile.webp 1x, ${folder}${file}--mobile@2x.webp 2x">

    <source media="(min-width: 1150px)" srcset="${folder}${file}--desktop.${format} 1x, ${folder}${file}--desktop@2x.${format} 2x">
    <source media="(min-width: 768px)" srcset="${folder}${file}--tablet.${format} 1x, ${folder}${file}--tablet@2x.${format} 2x">

    <img class="${classImg}" width="${width}" height="${height}" src="${folder}${file}--mobile.${format}" srcset="${folder}${file}--mobile@2x.${format} 2x" loading="lazy" alt="${alt}">
  </picture>`;
  return resultHtmlCode;
};
