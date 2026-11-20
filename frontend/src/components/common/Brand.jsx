import logo from '../../assets/icons/logo navbar.svg'

function Brand({ showEyebrow = false }) {
  return (
    <div className={`brand ${showEyebrow ? 'brand--footer' : ''}`}>
      <img src={logo} alt="Logo Rahayu Lestari" />
      <div>
        <div className="brand__name">
          <span>Rahayu</span>
          <span>Lestari</span>
        </div>
        {showEyebrow && <div className="brand__eyebrow">BANK SAMPAH DESA</div>}
      </div>
    </div>
  )
}

export default Brand
