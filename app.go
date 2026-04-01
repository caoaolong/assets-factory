package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// installDir 返回可执行文件所在目录（即典型安装目录），用于存放 settings.json、profile.json
func (a *App) installDir() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	resolved, err := filepath.EvalSymlinks(exe)
	if err == nil {
		exe = resolved
	}
	return filepath.Dir(exe), nil
}

func (a *App) readInstallJSONFile(filename string) (string, error) {
	dir, err := a.installDir()
	if err != nil {
		return "", err
	}
	path := filepath.Join(dir, filename)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}
	return string(data), nil
}

func (a *App) writeInstallJSONFile(filename string, content string) error {
	dir, err := a.installDir()
	if err != nil {
		return err
	}
	path := filepath.Join(dir, filename)
	return os.WriteFile(path, []byte(content), 0600)
}

// ReadSettingsJSON 读取安装目录下 settings.json 全文；不存在则返回空字符串（由前端按默认 JSON 处理）
func (a *App) ReadSettingsJSON() (string, error) {
	return a.readInstallJSONFile("settings.json")
}

// WriteSettingsJSON 将项目配置写入安装目录 settings.json
func (a *App) WriteSettingsJSON(json string) error {
	return a.writeInstallJSONFile("settings.json", json)
}

// ReadProfileJSON 读取安装目录下 profile.json；不存在则返回空字符串
func (a *App) ReadProfileJSON() (string, error) {
	return a.readInstallJSONFile("profile.json")
}

// WriteProfileJSON 将首选项写入安装目录 profile.json
func (a *App) WriteProfileJSON(json string) error {
	return a.writeInstallJSONFile("profile.json", json)
}
