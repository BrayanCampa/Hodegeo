import React, { useState } from 'react';
import { Bluetooth, MapPin, AlertTriangle, ShieldCheck, BatteryCharging, UserCheck, Activity, Radio, Cpu, RefreshCw, BarChart2 } from 'lucide-react';

export default function App() {
  const [isConnected, setIsConnected] = useState(true);
  const [sosActive, setSosActive] = useState(false);

  // Datos simulados para la gráfica de telemetría de proximidad
  const telemetryData = [
    { time: '10:00', val: 40 },
    { time: '10:01', val: 65 },
    { time: '10:02', val: 30 },
    { time: '10:03', val: 85 },
    { time: '10:04', val: 50 },
    { time: '10:05', val: 95 },
    { time: '10:06', val: 20 },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans p-6 flex flex-col justify-between">
      {/* Header Superior - Azul Cobalto y Blanco */}
      <header className="bg-blue-800 text-white rounded-xl px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-700 text-amber-400 rounded-lg border border-blue-600">
            <Cpu size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide flex items-center gap-2">
              Hodēgeō <span className="text-xs font-normal px-2 py-0.5 rounded bg-blue-900 text-blue-100 border border-blue-700">v1.0</span>
            </h1>
            <p className="text-xs text-blue-200">Panel de Monitoreo Central</p>
          </div>
        </div>

        <div className="flex items-center gap-5 text-sm">
          <div className="flex items-center gap-2 bg-blue-900/60 px-3 py-1.5 rounded-lg border border-blue-700">
            <Radio size={16} className="text-orange-400 animate-pulse" />
            <span className="text-xs text-blue-100">ESP32: Online</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-blue-200">
            <BatteryCharging size={18} className="text-emerald-400" />
            <span>Batería: 85%</span>
          </div>

          <button 
            onClick={() => setIsConnected(!isConnected)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isConnected 
                ? 'bg-emerald-600 text-white border-emerald-500' 
                : 'bg-red-600 text-white border-red-500'
            }`}
          >
            <Bluetooth size={16} />
            {isConnected ? 'BLE Activo' : 'Desconectado'}
          </button>
        </div>
      </header>

      {/* Estructura Asimétrica Dashboard */}
      <main className="grid grid-cols-12 gap-6 my-6 flex-1">
        
        {/* Columna Izquierda (4 columnas): Diagnóstico con Barras de Estado */}
        <div className="col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2 text-blue-800">
                <Activity size={18} className="text-orange-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Diagnóstico de Componentes</h2>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Auto-test</span>
            </div>

            {/* Lista de Componentes con Barras de Carga/Estado */}
            <div className="space-y-4">
              
              {/* Componente 1 */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">Microcontrolador ESP32</span>
                  <span className="text-emerald-600 font-semibold">98% Óptimo</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: '98%' }}></div>
                </div>
              </div>

              {/* Componente 2 */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">Sensor Ultrasónico HC-SR04</span>
                  <span className="text-emerald-600 font-semibold">90% Operativo</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: '90%' }}></div>
                </div>
              </div>

              {/* Componente 3 */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">Driver / Motor Háptico (2N2222)</span>
                  <span className="text-blue-600 font-semibold">100% Reposo</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                  <div className="bg-blue-600 h-full rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>

              {/* Componente 4 */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">Buzzer Piezoeléctrico</span>
                  <span className="text-blue-600 font-semibold">100% Standby</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                  <div className="bg-blue-600 h-full rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>

            </div>
          </div>

          <div className="bg-blue-50 p-3.5 rounded-lg border border-blue-100 mt-6">
            <div className="flex items-center gap-2 text-xs text-blue-900 font-medium mb-1">
              <ShieldCheck size={16} className="text-blue-700" />
              <span>Modo Autónomo</span>
            </div>
            <p className="text-xs text-slate-600">Lógica embebida en ESP32 procesando lecturas en tiempo real.</p>
          </div>
        </div>

        {/* Áreas Derechas (8 columnas): Gráfica + Geolocalización y Botón SOS */}
        <div className="col-span-8 flex flex-col gap-6">
          
          {/* Fila Superior: Gráfica de Lectura del Sensor Ultrasónico */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2 text-blue-800">
                <BarChart2 size={18} className="text-orange-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Telemetría de Obstáculos / Distancia (cm)</h2>
              </div>
              <span className="text-xs text-slate-400">Muestreo cada 100ms</span>
            </div>

            {/* Gráfica de Barras Simple */}
            <div className="h-36 flex items-end justify-between gap-3 pt-4 px-2">
              {telemetryData.map((item, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <div 
                    className={`w-full rounded-t transition-all ${item.val > 70 ? 'bg-orange-500' : 'bg-blue-700'}`} 
                    style={{ height: `${item.val}%` }}
                  ></div>
                  <span className="text-[10px] text-slate-400 font-mono">{item.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fila Inferior: Ubicación y Botón de Alerta */}
          <div className="grid grid-cols-2 gap-6">
            
            {/* Ubicación GPS */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center gap-2 text-blue-800 border-b border-slate-100 pb-3 mb-3">
                  <MapPin size={18} className="text-orange-500" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Ubicación Registrada</h2>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3">
                  <p className="text-[11px] text-slate-500">Última Detección GPS</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">Universidad del Valle de Guatemala</p>
                  <p className="text-xs font-medium text-slate-600">Plaza Iriarte, Zona 15</p>
                  <p className="text-xs text-blue-700 font-mono mt-1">14.6041° N, -90.4892° W</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                <span className="flex items-center gap-1"><RefreshCw size={12} /> Sync OK</span>
                <span className="flex items-center gap-1"><UserCheck size={12} className="text-orange-500" /> Contacto vinculado</span>
              </div>
            </div>

            {/* Simulación S.O.S */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center gap-2 text-blue-800 border-b border-slate-100 pb-3 mb-3">
                  <AlertTriangle size={18} className="text-orange-500" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Evento S.O.S</h2>
                </div>

                <button
                  onClick={() => setSosActive(!sosActive)}
                  className={`w-full py-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-colors border ${
                    sosActive
                      ? 'bg-orange-600 text-white border-orange-700 shadow-md'
                      : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
                  }`}
                >
                  <AlertTriangle size={20} />
                  {sosActive ? '¡ALERTA S.O.S RECIBIDA!' : 'SIMULAR DISPARO S.O.S'}
                </button>
              </div>

              <p className="text-[10px] text-slate-400 text-center mt-3">
                Interrupción por hardware vía Push Button
              </p>
            </div>

          </div>

        </div>

      </main>

      {/* Pie de Página Limpio */}
      <footer className="bg-white border border-slate-200 rounded-xl px-6 py-2.5 flex justify-between items-center text-xs text-slate-500 shadow-sm">
        <p className="text-slate-600 font-medium">Hodēgeō Telemetry Console</p>
        <p className="text-[11px] text-slate-400">CIMAT GT2026</p>
      </footer>
    </div>
  );
}

{/*esta porqueria no es 100% veridica, solo fue para sacar la presentación. 
  pero funciona como base*/}