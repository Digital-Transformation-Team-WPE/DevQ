// REFERENCE FILE ONLY – not imported in production.
import { useState }    from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

import logoLeft   from '../assets/digital-transformation.png';
import logoRight  from '../assets/stellantis-logo.jpg';
import loginImage from '../assets/loginPage.png';

const LandingPage = () => {
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  const handleMicrosoftLogin = () => {
    window.location.href = 'https://login.microsoftonline.com/';
  };

  return (
    <div className="landing-container">

      <img src={logoLeft}   alt="Left Logo"  className="logo-top-left"  />
      <img src={logoRight}  alt="Right Logo" className="logo-top-right" />

      <div className="landing-left">
        <img src={loginImage} alt="Illustration" className="landing-image" />
      </div>

      {/* RIGHT SIDE */}
      <div className="landing-right">
        <div className="login-block">

          <div className="landing-welcome">
            Welcome to R Studio
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div>
              <label>User Id</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div>
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className='loginbtn'>
                <button className="login-btn" type="submit">
              Login
            </button>
            </div>
          </form>

          <div className="separator">or</div>

          <button 
            className="enterprise-login-btn"
            onClick={handleMicrosoftLogin}
          >
            Login with Microsoft
          </button>

        </div>
      </div>
    </div>
  );
};

export default LandingPage;