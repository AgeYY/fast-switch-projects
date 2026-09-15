// Synthetic Win32 windows for helper integration tests. This is NOT VS Code;
// naming the fixture Code.exe exercises the production process/class allowlist.
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Collections.Generic;
using System.Web.Script.Serialization;
class Fixture {
    delegate IntPtr WndProc(IntPtr h,uint m,IntPtr w,IntPtr l);
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct WClass {
        public uint style; public WndProc proc; public int clsExtra,winExtra; public IntPtr instance,icon,cursor,background;
        public string menu,name;
    }
    [StructLayout(LayoutKind.Sequential)] struct Rect {public int left,top,right,bottom;}
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern ushort RegisterClass(ref WClass c);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr CreateWindowEx(int ex,string cls,string title,int style,int x,int y,int w,int h,IntPtr parent,IntPtr menu,IntPtr instance,IntPtr param);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr DefWindowProc(IntPtr h,uint m,IntPtr w,IntPtr l);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h,int n);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h,out Rect r);
    [DllImport("user32.dll")] static extern bool DestroyWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    static WndProc proc=DefWindowProc;
    [STAThread] static void Main(string[] args) {
        var root=args[0]; Directory.CreateDirectory(root);
        var json=new JavaScriptSerializer();
        var cls=new WClass {name="Chrome_WidgetWin_1",proc=proc}; RegisterClass(ref cls);
        var windows=new List<IntPtr>();
        for(int i=0;i<4;i++) windows.Add(CreateWindowEx(0,cls.name,i==3?"Unrelated fixture":"Fixture [FSP:"+new string((char)('a'+i),32)+"]",0x10CF0000,100+20*i,100+20*i,850,550,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero));
        SetForegroundWindow(windows[0]);
        int ticks=0; string last="";
        var timer=new Timer {Interval=100};
        timer.Tick+=(sender,e)=>{
            string request=Path.Combine(root,"fixture-command.json");
            if(File.Exists(request)) { try {
                var r=json.Deserialize<Dictionary<string,object>>(File.ReadAllText(request));
                string id=Convert.ToString(r["id"]);
                if(id!=last) { last=id; int index=Convert.ToInt32(r["index"]); string op=Convert.ToString(r["op"]);
                    if(op=="focus") SetForegroundWindow(windows[index]);
                    if(op=="maximize") {ShowWindow(windows[index],3);SetForegroundWindow(windows[index]);}
                    if(op=="move") {ShowWindow(windows[index],9);SetWindowPos(windows[index],IntPtr.Zero,220,160,910,620,4);SetForegroundWindow(windows[index]);}
                    if(op=="close") DestroyWindow(windows[index]);
                    if(op=="quit") Application.Exit();
                }
            } catch {} }
            var rows=new List<object>(); foreach(var h in windows) {Rect rect; GetWindowRect(h,out rect);rows.Add(new{hwnd=h.ToInt64(),valid=IsWindow(h),visible=IsWindowVisible(h),maximized=IsZoomed(h),rect=rect,focused=GetForegroundWindow()==h});}
            try {
                var dest=Path.Combine(root,"fixture-state.json"); var temp=dest+".tmp";
                File.WriteAllText(temp,json.Serialize(new{ticks=++ticks,windows=rows}));
                if(File.Exists(dest)) File.Replace(temp,dest,null); else File.Move(temp,dest);
            } catch {}
        };
        timer.Start(); Application.Run();
    }
}
