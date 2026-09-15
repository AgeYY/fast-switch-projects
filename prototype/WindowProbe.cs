// Read-only native observations for live acceptance tests; no input or window mutations.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;
class WindowProbe {
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int left,top,right,bottom; }
    delegate bool EnumProc(IntPtr h,IntPtr p);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p,IntPtr l);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder s,int n);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out int pid);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h,out Rect r);
    [DllImport("user32.dll")] static extern int GetSystemMetrics(int n);
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr p);
    static void Main() {
        SetProcessDpiAwarenessContext(new IntPtr(-4));
        var windows=new List<object>();
        EnumWindows((h,l)=>{
            var cls=new StringBuilder(256);GetClassName(h,cls,256);
            if(cls.ToString()!="Chrome_WidgetWin_1")return true;
            int pid;GetWindowThreadProcessId(h,out pid);
            try {if(Process.GetProcessById(pid).ProcessName!="Code")return true;}catch{return true;}
            Rect rect;GetWindowRect(h,out rect);
            windows.Add(new{hwnd=h.ToInt64(),pid=pid,visible=IsWindowVisible(h),maximized=IsZoomed(h),focused=GetForegroundWindow()==h,rect=rect});return true;
        },IntPtr.Zero);
        Console.WriteLine(new JavaScriptSerializer().Serialize(new{monitors=GetSystemMetrics(80),windows=windows}));
    }
}
