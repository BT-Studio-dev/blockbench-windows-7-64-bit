; ==============================================================================
; Blockbench - Windows 7 / 8 64-bit NSIS customizations
; ------------------------------------------------------------------------------
; Included by electron-builder in the shared script header, before the
; generated installer body (app-builder-lib, NsisTarget.js ->
; computeCommonInstallerScriptHeader() -> options.include). Everything here is
; additive: no electron-builder macro is replaced as a whole, only the three
; documented hook macros customInit / customInstall / customFinishPage are used.
;
; What this fixes on Windows 7 SP1 x64
; ------------------------------------
; 1) "Run Blockbench" on the Finish page failed with an "Unspecified error"
;    dialog titled with the Start Menu path of Blockbench.lnk.
;    electron-builder launches the app through StdUtils::ExecShellAsUser, which
;    is IShellDispatch2::ShellExecute on the freshly written .lnk and falls back
;    to ShellExecute. For .lnk files the shell requires lpVerb and lpClassname
;    to be NULL; the template passes the verb "open". On Windows 7 that fails
;    with E_FAIL, which Explorer surfaces as the "Unspecified error" box named
;    after the link.
;    Fix: customFinishPage replaces the Finish page and starts the executable
;    itself, without going through the shell or the .lnk at all.
;
; 2) The shortcuts are stamped with WinShell::SetLnkAUMI (an AppUserModelID
;    property store write). Under Unicode NSIS on Windows 7 that property is
;    not honoured, and a link carrying an id that the target executable does
;    not publish is left in a state Explorer cannot resolve, so the Start Menu
;    entry fails the same way.
;    Fix: customInstall rebuilds the Start Menu link after the template wrote
;    it, and writes the AppUserModelID only on Windows 8 and newer, where it is
;    needed for taskbar grouping and toast notifications.
;
; 3) The app is x64 only and Electron 22 needs Windows 7 SP1. The installer now
;    stops (32-bit) or asks (older Windows) instead of failing later with an
;    unrelated error. An unattended /S install is never blocked by a dialog.
;
; Only WinVer.nsh, LogicLib.nsh, x64.nsh from the NSIS distribution and the
; plugins electron-builder already ships are used. Syntax is kept compatible
; with NSIS 3.04 (what electron-builder 23.6 bundles) and NSIS 3.13.
; ==============================================================================

!include WinVer.nsh
!include LogicLib.nsh
!include x64.nsh

!ifndef BUILD_UNINSTALLER

; ------------------------------------------------------------------------------
; Globals for the OS check (plugin and macro calls clobber $0..$9/$R0..$R9).
; ------------------------------------------------------------------------------
Var /GLOBAL bbOsMajor
Var /GLOBAL bbOsMinor
Var /GLOBAL bbOsServicePack

; ------------------------------------------------------------------------------
; customInit: refuse 32-bit Windows, warn about Windows versions older than
; Windows 7 SP1. Runs from .onInit, before any file is written.
; ------------------------------------------------------------------------------
!macro customInit
  ${WinVerGetMajor} $bbOsMajor
  ${WinVerGetMinor} $bbOsMinor
  ${WinVerGetServicePackLevel} $bbOsServicePack

  ; The build installs a 64-bit Electron; on 32-bit Windows it can never start.
  ${IfNot} ${RunningX64}
    ${IfNot} ${Silent}
      MessageBox MB_ICONSTOP|MB_OK \
        "Blockbench requires 64-bit Windows 7 Service Pack 1 or newer.$\r$\n$\r$\n\
         This computer is running a 32-bit version of Windows, which Blockbench \
         can not run on."
    ${EndIf}
    Quit
  ${EndIf}

  ; 6.1.7601 is Windows 7 SP1. Anything newer is fine, anything older is not
  ; supported by Electron 22 - but do not lock the user out if the version is
  ; misreported (compatibility mode), ask instead.
  ${If} $bbOsMajor > 6
    Goto bbOsOk
  ${ElseIf} $bbOsMajor < 6
    Goto bbOsOld
  ${ElseIf} $bbOsMinor > 1
    Goto bbOsOk
  ${ElseIf} $bbOsMinor < 1
    Goto bbOsOld
  ${ElseIf} $bbOsServicePack < 1
    Goto bbOsOld
  ${EndIf}
  Goto bbOsOk

  bbOsOld:
    ; Never block an unattended install with a dialog.
    ${IfNot} ${Silent}
      MessageBox MB_ICONEXCLAMATION|MB_YESNO \
        "Blockbench is built for Windows 7 Service Pack 1 or newer.$\r$\n$\r$\n\
         This computer reports Windows $bbOsMajor.$bbOsMinor (Service Pack \
         $bbOsServicePack), so Blockbench may not start after the installation.$\r$\n$\r$\n\
         Continue anyway?" \
        IDYES bbOsOk
      Quit
    ${EndIf}

  bbOsOk:
!macroend

; ------------------------------------------------------------------------------
; customInstall: guarantee a working Start Menu shortcut.
;
; Runs inside the install section, after addStartMenuLink/addDesktopLink, so
; $newStartMenuLink and $newDesktopLink are already set and the links exist.
; Deleting and recreating the link drops the AppUserModelID property that the
; template wrote with WinShell::SetLnkAUMI.
; ------------------------------------------------------------------------------
!macro customInstall
  !ifndef DO_NOT_CREATE_START_MENU_SHORTCUT
    ; The target directory may not have been created when the template skipped
    ; its own shortcut creation (keep-shortcuts upgrade path).
    !ifdef MENU_FILENAME
      CreateDirectory "$SMPROGRAMS\${MENU_FILENAME}"
      ClearErrors
    !endif

    Delete "$newStartMenuLink"
    ClearErrors
    CreateShortCut "$newStartMenuLink" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" \
      "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 SW_SHOWNORMAL "" "${APP_DESCRIPTION}"
    ClearErrors

    ; AppUserModelID only from Windows 8 on. On Windows 7 the stamp is what
    ; breaks the link, so the property stays off there.
    ${IfNot} ${AtMostWin7}
      WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
      ClearErrors
    ${EndIf}
  !endif

  ; The desktop link is only repaired when it exists: users that removed it
  ; should not get it back on every update.
  !ifndef DO_NOT_CREATE_DESKTOP_SHORTCUT
    ${IfNot} ${isNoDesktopShortcut}
    ${AndIf} ${FileExists} "$newDesktopLink"
      Delete "$newDesktopLink"
      ClearErrors
      CreateShortCut "$newDesktopLink" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" \
        "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 SW_SHOWNORMAL "" "${APP_DESCRIPTION}"
      ClearErrors

      ${IfNot} ${AtMostWin7}
        WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
        ClearErrors
      ${EndIf}
    ${EndIf}
  !endif
!macroend

; ------------------------------------------------------------------------------
; customFinishPage: the standard Finish page, but "Run Blockbench" starts the
; executable directly instead of the shortcut through the Explorer shell.
;
; assistedInstaller.nsh inserts this macro in place of its own
; "Function StartApp + MUI_PAGE_FINISH" block when the macro exists, so the
; template's shell-based StartApp is never called from the Finish page.
; StartApp itself is left untouched: silent force-run installs still use it.
; ------------------------------------------------------------------------------
!macro customFinishPage
  !ifndef HIDE_RUN_AFTER_FINISH

    Function bbStartApp
      ; Preferred: the installed executable. No shell, no .lnk, so the
      ; "Unspecified error" Explorer dialog can not appear here.
      ${If} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
        ${If} ${isUpdated}
          Exec '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --updated'
        ${Else}
          Exec '"$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
        ${EndIf}

      ; Fallback: the Start Menu link, if the executable is not there for some
      ; reason. This goes through the shell, which is exactly what the
      ; shortcut is for.
      ${ElseIf} ${FileExists} "$newStartMenuLink"
        ${If} ${isUpdated}
          ExecShell "open" "$newStartMenuLink" "--updated"
        ${Else}
          ExecShell "open" "$newStartMenuLink"
        ${EndIf}
      ${EndIf}
    FunctionEnd

    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "bbStartApp"
  !endif

  !insertmacro MUI_PAGE_FINISH
!macroend

!endif ; BUILD_UNINSTALLER
