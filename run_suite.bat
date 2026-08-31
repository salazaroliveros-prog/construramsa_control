@echo off
REM Suite de pruebas CONSTRURAMSA — ejecuta los tests secuencialmente con log.
cd /d "%~dp0"
echo ===INICIO %date% %time% > suite_result.log
echo [1/5] test_smoke >> suite_result.log
call node test_smoke.js >> suite_result.log 2>&1
echo [2/5] test_ux_files >> suite_result.log
call node test_ux_files.js >> suite_result.log 2>&1
echo [3/5] test_crud >> suite_result.log
call node test_crud.js >> suite_result.log 2>&1
echo [4/5] test_reportes >> suite_result.log
call node test_reportes.js >> suite_result.log 2>&1
echo [5/5] test_reportes_validation >> suite_result.log
call node test_reportes_validation.js >> suite_result.log 2>&1
echo ===FIN %date% %time% >> suite_result.log
exit