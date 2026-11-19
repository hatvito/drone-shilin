// ============================================================================
// js/blockly/drone-toolbox.js: Blockly 工具箱分類清單與預設避障範本
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const DRONE_TOOLBOX = {
        kind: 'categoryToolbox',
        contents: [
            {
                kind: 'category',
                name: '🛸 飛行動作',
                colour: '#0284c7',
                contents: [
                    { kind: 'block', type: 'drone_set_cruise_speed' },
                    { kind: 'block', type: 'drone_set_cruise_altitude' },
                    { kind: 'block', type: 'drone_auto_lidar_repulsion' },
                    { kind: 'block', type: 'drone_steer_dodge' },
                    { kind: 'block', type: 'drone_emergency_brake' },
                    { kind: 'block', type: 'drone_custom_velocity' }
                ]
            },
            {
                kind: 'category',
                name: '📡 光達感測',
                colour: '#06b6d4',
                contents: [
                    { kind: 'block', type: 'drone_raycast_distance' },
                    { kind: 'block', type: 'drone_lidar_min_distance' },
                    { kind: 'block', type: 'drone_target_distance' },
                    { kind: 'block', type: 'drone_current_altitude' }
                ]
            },
            {
                kind: 'category',
                name: '👁️ 雙目與毫米波',
                colour: '#a855f7',
                contents: [
                    { kind: 'block', type: 'drone_stereo_detect_wire' },
                    { kind: 'block', type: 'drone_stereo_wire_warning' },
                    { kind: 'block', type: 'drone_radar_detect_moving' },
                    { kind: 'block', type: 'drone_radar_has_incoming_threat' }
                ]
            },
            {
                kind: 'category',
                name: '📐 坡度與超音波',
                colour: '#f97316',
                contents: [
                    { kind: 'block', type: 'drone_tof_surface_slope' },
                    { kind: 'block', type: 'drone_tof_ground_clearance' },
                    { kind: 'block', type: 'drone_ultrasonic_cushion' },
                    { kind: 'block', type: 'drone_ultrasonic_min_distance' },
                    { kind: 'block', type: 'drone_optical_flow_drift' },
                    { kind: 'block', type: 'drone_optical_flow_wind_compensation' }
                ]
            },
            {
                kind: 'category',
                name: '🔋 電池與負重',
                colour: '#10b981',
                contents: [
                    { kind: 'block', type: 'drone_get_battery' },
                    { kind: 'block', type: 'drone_is_low_battery' },
                    { kind: 'block', type: 'drone_enable_eco_mode' },
                    { kind: 'block', type: 'drone_get_total_payload' },
                    { kind: 'block', type: 'drone_get_payload_limit' }
                ]
            },
            {
                kind: 'category',
                name: '⚡ 邏輯條件',
                colour: '#14b8a6',
                contents: [
                    { kind: 'block', type: 'controls_if' },
                    { kind: 'block', type: 'logic_compare' },
                    { kind: 'block', type: 'logic_operation' },
                    { kind: 'block', type: 'logic_negate' },
                    { kind: 'block', type: 'logic_boolean' }
                ]
            },
            {
                kind: 'category',
                name: '📐 數值運算',
                colour: '#6366f1',
                contents: [
                    { kind: 'block', type: 'math_number' },
                    { kind: 'block', type: 'math_arithmetic' },
                    { kind: 'block', type: 'math_single' },
                    { kind: 'block', type: 'math_random_int' }
                ]
            },
            {
                kind: 'category',
                name: '📦 變數',
                custom: 'VARIABLE',
                colour: '#f59e0b'
            }
        ]
    };

    const DEFAULT_WORKSPACE_XML = `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="drone_on_step" x="40" y="30" deletable="false">
    <statement name="DO">
      <block type="drone_set_cruise_speed">
        <field name="SPEED">11.5</field>
        <next>
          <block type="drone_set_cruise_altitude">
            <field name="ALTITUDE">12.5</field>
            <next>
              <block type="drone_auto_lidar_repulsion">
                <field name="RADIUS">15</field>
                <field name="FORCE">2.2</field>
                <next>
                  <block type="controls_if">
                    <value name="IF0">
                      <block type="logic_compare">
                        <field name="OP">LT</field>
                        <value name="A">
                          <block type="drone_raycast_distance">
                            <field name="DIR">FRONT</field>
                            <field name="RANGE">25</field>
                          </block>
                        </value>
                        <value name="B">
                          <block type="math_number">
                            <field name="NUM">8</field>
                          </block>
                        </value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="drone_emergency_brake">
                        <field name="PERCENT">50</field>
                      </block>
                    </statement>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>
`;

    ns.BlocklyToolbox = {
        DRONE_TOOLBOX,
        DEFAULT_WORKSPACE_XML
    };
})(window.ShilinDrone);
